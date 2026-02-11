import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as forge from "npm:node-forge@1.3.1";

// Minimal 29x29 blue PNG (Tufts blue #3E8EDE) for icon.png
const ICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAOklEQVRIx2P4" +
  "z8BQz0BHwMRAZ8BE78BCNA0M9AYjlo5aOmrpqKWjlo5aOmrpqKWjlo5aOkotBQA7AQYB" +
  "FCTligAAAABJRU5ErkJggg==";

// Minimal 160x50 white PNG for logo.png
const LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAAAnCAYAAABdEfBWAAAAP0lEQVR4nO3B" +
  "MQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAB+BjUsAAFe0nNIAAAAAElFTkSuQmCC";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservation_id");
    if (!reservationId) {
      return new Response(JSON.stringify({ error: "reservation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: accept either Authorization header or token query param (for Linking.openURL)
    const authHeader = req.headers.get("Authorization");
    const tokenParam = url.searchParams.get("token");
    const token = authHeader?.replace("Bearer ", "") || tokenParam;

    if (!token) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch reservation + event
    const { data: reservation, error: resError } = await supabase
      .from("event_reservations")
      .select("*, event:events(*)")
      .eq("id", reservationId)
      .eq("user_id", user.id)
      .single();

    if (resError || !reservation) {
      return new Response(JSON.stringify({ error: "Reservation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reservation.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Cannot create pass for cancelled reservation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = reservation.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read Apple certs from env
    const passTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");
    const teamId = Deno.env.get("APPLE_TEAM_ID");
    const certPem = Deno.env.get("APPLE_PASS_CERT_PEM");
    const keyPem = Deno.env.get("APPLE_PASS_KEY_PEM");
    const wwdrPem = Deno.env.get("APPLE_WWDR_CERT_PEM");

    if (!passTypeId || !teamId || !certPem || !keyPem || !wwdrPem) {
      return new Response(JSON.stringify({ error: "Apple Wallet certificates not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build pass.json
    const startDate = new Date(event.start_time);
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      serialNumber: `jumbo-${reservation.id}`,
      teamIdentifier: teamId,
      organizationName: event.organizer_name || "JumboNow",
      description: `Ticket for ${event.title}`,
      logoText: "JumboNow",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(62, 142, 222)",
      labelColor: "rgb(200, 225, 255)",
      barcode: {
        message: reservation.confirmation_code,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      },
      barcodes: [
        {
          message: reservation.confirmation_code,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
        },
      ],
      eventTicket: {
        primaryFields: [
          {
            key: "event",
            label: "EVENT",
            value: event.title,
          },
        ],
        secondaryFields: [
          {
            key: "date",
            label: "DATE",
            value: startDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
          },
          {
            key: "time",
            label: "TIME",
            value: startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
          },
        ],
        auxiliaryFields: [
          {
            key: "location",
            label: "LOCATION",
            value: event.location || "TBD",
          },
          {
            key: "confirmation",
            label: "CONFIRMATION",
            value: reservation.confirmation_code,
          },
        ],
      },
      relevantDate: event.start_time,
    };

    const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson));
    const iconBytes = Uint8Array.from(atob(ICON_BASE64), (c) => c.charCodeAt(0));
    const logoBytes = Uint8Array.from(atob(LOGO_BASE64), (c) => c.charCodeAt(0));

    // Build manifest.json (SHA1 hashes)
    function sha1Hex(data: Uint8Array): string {
      const md = forge.md.sha1.create();
      md.update(forge.util.binary.raw.decode(data));
      return md.digest().toHex();
    }

    const manifest: Record<string, string> = {
      "pass.json": sha1Hex(passJsonBytes),
      "icon.png": sha1Hex(iconBytes),
      "logo.png": sha1Hex(logoBytes),
    };
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

    // Sign manifest with PKCS#7
    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(keyPem);
    const wwdrCert = forge.pki.certificateFromPem(wwdrPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(
      forge.util.binary.raw.decode(manifestBytes)
    );
    p7.addCertificate(cert);
    p7.addCertificate(wwdrCert);
    p7.addSigner({
      key: key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha1,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.messageDigest,
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date(),
        },
      ],
    });
    p7.sign({ detached: true });

    const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const signatureBytes = Uint8Array.from(signatureDer, (c: string) => c.charCodeAt(0));

    // Build ZIP (.pkpass) manually
    const zipParts: { name: string; data: Uint8Array }[] = [
      { name: "pass.json", data: passJsonBytes },
      { name: "icon.png", data: iconBytes },
      { name: "logo.png", data: logoBytes },
      { name: "manifest.json", data: manifestBytes },
      { name: "signature", data: signatureBytes },
    ];

    const zipBuffer = buildZip(zipParts);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="jumbo-${reservation.confirmation_code}.pkpass"`,
      },
    });
  } catch (err) {
    console.error("wallet-pass error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Build a ZIP file from an array of {name, data} entries (no compression, store only) */
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const centralDir: Uint8Array[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);

    // Local file header (30 + nameLen)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // general purpose bit flag
    lv.setUint16(8, 0, true); // compression method (store)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc32(file.data), true); // crc32
    lv.setUint32(18, file.data.length, true); // compressed size
    lv.setUint32(22, file.data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // file name length
    lv.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdEntry.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory file header signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // general purpose bit flag
    cv.setUint16(10, 0, true); // compression method
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0, true); // mod date
    cv.setUint32(16, crc32(file.data), true); // crc32
    cv.setUint32(20, file.data.length, true); // compressed size
    cv.setUint32(24, file.data.length, true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // file name length
    cv.setUint16(30, 0, true); // extra field length
    cv.setUint16(32, 0, true); // file comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal file attributes
    cv.setUint32(38, 0, true); // external file attributes
    cv.setUint32(42, offset, true); // relative offset of local header
    cdEntry.set(nameBytes, 46);

    centralDir.push(cdEntry);
    parts.push(localHeader);
    parts.push(file.data);
    offset += localHeader.length + file.data.length;
  }

  // End of central directory
  let cdSize = 0;
  for (const cd of centralDir) cdSize += cd.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central dir signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk where central directory starts
  ev.setUint16(8, files.length, true); // entries on this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, cdSize, true); // size of central directory
  ev.setUint32(16, offset, true); // offset of central directory
  ev.setUint16(20, 0, true); // comment length

  // Concatenate all parts
  const totalSize = offset + cdSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const cd of centralDir) {
    result.set(cd, pos);
    pos += cd.length;
  }
  result.set(eocd, pos);

  return result;
}

/** CRC32 computation */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const table = getCrc32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crc32Table: Uint32Array | null = null;
function getCrc32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table;
  _crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    _crc32Table[i] = c >>> 0;
  }
  return _crc32Table;
}
