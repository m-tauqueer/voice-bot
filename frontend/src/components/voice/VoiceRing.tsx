import { useEffect, useRef, type CSSProperties } from "react";

type WebGLResources = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: {
    time: WebGLUniformLocation | null;
    amplitude: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
  };
};

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAmplitude;
  uniform vec2 uResolution;

  float bayerDither(vec2 coord) {
    vec2 p = floor(mod(coord, 8.0));
    float x = p.x;
    float y = p.y;

    float index =
      1.0 * mod(x, 2.0) +
      2.0 * mod(y, 2.0) +
      4.0 * mod(floor(x / 2.0), 2.0) +
      8.0 * mod(floor(y / 2.0), 2.0) +
      16.0 * mod(floor(x / 4.0), 2.0) +
      32.0 * mod(floor(y / 4.0), 2.0);

    return (index + 0.5) / 64.0;
  }

  void main() {
    vec2 normalized = gl_FragCoord.xy / uResolution;
    vec2 uv = normalized * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    float time = uTime * 0.5;
    float amplitude = clamp(uAmplitude, 0.0, 1.2);

    float radius = 0.21 + amplitude * 0.11 + sin(time * 0.9) * 0.012;
    float thickness = 0.07 + amplitude * 0.05 + sin(time * 0.63) * 0.009;

    float dist = length(uv);
    float ring = smoothstep(radius + thickness, radius, dist) - smoothstep(radius, radius - thickness, dist);
    float glow = exp(-14.0 * abs(dist - radius));
    float halo = exp(-6.5 * dist * (1.0 + amplitude * 0.35));

    float intensity = clamp(ring * 0.75 + glow * 0.5 + halo * 0.08, 0.0, 1.0);
    float threshold = bayerDither(gl_FragCoord.xy);
    float shade = step(threshold, intensity);

    gl_FragColor = vec4(vec3(shade), 1.0);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info ?? "Unknown shader compilation error");
  }
  return shader;
}

export function VoiceRing({
  amplitude,
  smoothing,
  className,
  style,
}: {
  amplitude: number;
  smoothing: number;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRef = useRef<WebGLResources | null>(null);
  const frameRef = useRef<number | null>(null);
  const amplitudeRef = useRef(amplitude);
  const targetRef = useRef(amplitude);
  const smoothingRef = useRef(smoothing);

  targetRef.current = amplitude;
  smoothingRef.current = smoothing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
    } catch {
      return;
    }
    if (!gl) {
      return;
    }

    try {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENT_SHADER,
      );
      const program = gl.createProgram();
      if (!program) {
        throw new Error("Unable to create WebGL program");
      }
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(info ?? "Unknown WebGL linking error");
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(program);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      webglRef.current = {
        gl,
        program,
        uniforms: {
          time: gl.getUniformLocation(program, "uTime"),
          amplitude: gl.getUniformLocation(program, "uAmplitude"),
          resolution: gl.getUniformLocation(program, "uResolution"),
        },
      };

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.round(rect.width * pixelRatio);
        const height = Math.round(rect.height * pixelRatio);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
      };

      const render = (time: number) => {
        frameRef.current = requestAnimationFrame(render);
        const resources = webglRef.current;
        if (!resources) {
          return;
        }
        resize();
        resources.gl.useProgram(resources.program);
        resources.gl.clearColor(0, 0, 0, 1);
        resources.gl.clear(resources.gl.COLOR_BUFFER_BIT);

        const blend = 1 - smoothingRef.current;
        const next =
          amplitudeRef.current +
          (targetRef.current - amplitudeRef.current) * blend;
        amplitudeRef.current = next;

        if (resources.uniforms.time) {
          resources.gl.uniform1f(resources.uniforms.time, time * 0.001);
        }
        if (resources.uniforms.amplitude) {
          resources.gl.uniform1f(resources.uniforms.amplitude, next);
        }
        if (resources.uniforms.resolution) {
          resources.gl.uniform2f(
            resources.uniforms.resolution,
            resources.gl.drawingBufferWidth,
            resources.gl.drawingBufferHeight,
          );
        }
        resources.gl.drawArrays(resources.gl.TRIANGLES, 0, 6);
      };

      resize();
      render(0);

      return () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = null;
        if (webglRef.current) {
          webglRef.current.gl.deleteProgram(webglRef.current.program);
        }
        webglRef.current = null;
      };
    } catch {
      webglRef.current = null;
      return;
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
}