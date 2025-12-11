import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

// Build plugin runtime to bin/
const pluginConfig = {
  input: 'src/plugin.ts',
  output: {
    dir: 'com.ram-wich.smartthings.sdPlugin/bin',
    format: 'es',
    sourcemap: false
  },
  plugins: [resolve(), commonjs(), typescript()]
};

// Build property inspector to ui/
const piConfig = {
  input: 'src/propertyinspector.ts',
  output: {
    dir: 'com.ram-wich.smartthings.sdPlugin/ui',
    format: 'es',
    sourcemap: false
  },
  plugins: [resolve(), commonjs(), typescript()]
};

export default [pluginConfig, piConfig];