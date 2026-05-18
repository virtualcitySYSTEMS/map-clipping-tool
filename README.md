# @vcmap/clipping-tool

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

VC Map Plugin for adding horizontal and vertical clipping planes to active CesiumTilesetLayers in the 3D Map.

## Configuration

### Configuration Parameters

The clipping tool supports the following configuration options:

| Parameter                   | Type    | Default | Description                                                                                                 |
| --------------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `horizontalExtrusionHeight` | number  | 0       | The height of the horizontal clipping plane extrusion in meters. A value of 0 means no extrusion.           |
| `verticalExtrusionHeight`   | number  | 50      | The height of the vertical clipping plane extrusion in meters. Controls how far the vertical plane extends. |
| `isInfinite`                | boolean | false   | If true, the clipping planes extend infinitely instead of being bounded.                                    |
| `cutsGlobe`                 | boolean | false   | If true, allows the clipping planes to cut through the globe surface.                                       |
| `verticalRotation`          | number  | 0       | The horizontal rotation angle of the clipping plane, in degrees.                                            |

### Configuration Example

```json
{
  "horizontalExtrusionHeight": 10,
  "verticalExtrusionHeight": 100,
  "isInfinite": false,
  "cutsGlobe": true,
  "verticalRotation": false
}
```
