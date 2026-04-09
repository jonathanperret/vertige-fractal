export interface CrosshairShape {
  stroke: number;
  radius: number;
}

export interface MandelbrotShaderOptions {
  maxIterations?: number;
  antiAliasing?: number;
  escapeRadius?: number;
  showCrosshair?: boolean;
  crosshair?: CrosshairShape;
  paletteSize?: number;
}

export const defaultCrosshair: CrosshairShape = {
  stroke: 2,
  radius: 100,
};

export const fullscreenVertexShader = `
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;

export const fullscreenVertexArray = {
  position: {
    data: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    numComponents: 3,
  },
};

export const overlayVertexShader = `
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec4 u_rect;
varying vec2 v_texCoord;

void main() {
  vec2 pixel = u_rect.xy + a_position * u_rect.zw;
  vec2 ndc = (pixel / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_texCoord = a_position;
}
`;

export const overlayFragmentShader = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord);
}
`;

export const overlayQuadArray = {
  a_position: {
    data: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
    numComponents: 2,
  },
};

export function createMandelbrotFragmentShader({
  maxIterations = 300,
  antiAliasing = 1,
  escapeRadius = 64,
  showCrosshair = false,
  crosshair = defaultCrosshair,
  paletteSize = 8,
}: MandelbrotShaderOptions): string {
  return `
// Adapted from the Mandelbrot Maps shader, itself based on work by inigo quilez.

#define false 0
#define true 1

#define AA ${antiAliasing}
#define MAXI ${maxIterations}
#define B ${escapeRadius.toFixed(1)}

#define show_crosshair ${showCrosshair}
#define cross_stroke ${crosshair.stroke.toFixed(1)}
#define cross_radius ${crosshair.radius.toFixed(1)}

#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

uniform vec2 resolution;
uniform vec2 u_xy;
uniform float u_zoom;
uniform float u_theta;
uniform vec3 u_palette[${paletteSize}];
uniform float u_paletteSpeed;

bool crosshair(float x, float y) {
  float abs_x = abs(2.0 * x - resolution.x);
  float abs_y = abs(2.0 * y - resolution.y);

  return
    (abs_x <= cross_stroke || abs_y <= cross_stroke) &&
    (abs_x <= cross_radius && abs_y <= cross_radius);
}

float mandelbrot(in vec2 c) {
  {
    float c2 = dot(c, c);
    if (256.0 * c2 * c2 - 96.0 * c2 + 32.0 * c.x - 3.0 < 0.0) return 0.0;
    if (16.0 * (c2 + 2.0 * c.x + 1.0) - 1.0 < 0.0) return 0.0;
  }

  float l = 0.0;
  vec2 z = vec2(0.0);
  for (int i = 0; i < MAXI; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > (B * B)) break;
    l += 1.0;
  }

  if (l > float(MAXI) - 1.0) return 0.0;

  l = l - log2(log2(dot(z, z))) + 4.0;
  return l;
}

void main() {
  vec3 col = vec3(0.0);

  #if AA > 1
  for (int m = 0; m < AA; m++)
  for (int n = 0; n < AA; n++) {
    vec2 p = (2.0 * (gl_FragCoord.xy + vec2(float(m), float(n)) / float(AA)) - resolution.xy) / resolution.y;
  #else
    vec2 p = (2.0 * gl_FragCoord.xy - resolution.xy) / resolution.y;
  #endif

    float sinT = sin(u_theta);
    float cosT = cos(u_theta);
    vec2 xy = vec2(p.x * cosT - p.y * sinT, p.x * sinT + p.y * cosT);
    vec2 c = u_xy + xy / u_zoom;

    float l = mandelbrot(c);

    if (l > 0.0) {
      float t = mod(l * u_paletteSpeed, 1.0) * ${paletteSize - 1}.0;
      int idx = int(floor(t));
      float frac = t - floor(t);
      vec3 c1 = u_palette[0];
      vec3 c2 = u_palette[0];
      for (int i = 0; i < ${paletteSize}; i++) {
        if (i == idx) c1 = u_palette[i];
        if (i == idx + 1) c2 = u_palette[i];
      }
      col += mix(c1, c2, frac);
    }

  #if AA > 1
  }
  col /= float(AA * AA);
  #endif

  #if show_crosshair
  if (crosshair(gl_FragCoord.x, gl_FragCoord.y)) {
    col = 1.0 - col;
  }
  #endif

  gl_FragColor = vec4(col, 1.0);
}
`;
}
