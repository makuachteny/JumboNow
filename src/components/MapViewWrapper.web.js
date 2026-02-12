import React from 'react';
import { View } from 'react-native';

// Stub components for web where react-native-maps is not supported
const MapView = React.forwardRef((props, ref) => {
  const { style, children, onPress, ...rest } = props;
  return (
    <View ref={ref} style={style} onClick={onPress}>
      {children}
    </View>
  );
});

MapView.displayName = 'MapView';

export const Marker = ({ children }) => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = null;

export default MapView;
