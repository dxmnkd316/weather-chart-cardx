import resolve from 'rollup-plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import typescript from '@rollup/plugin-typescript';

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/weather-chart-card.js',
    format: 'cjs',
    name: 'WeatherChartCard',
    sourcemap: dev ? true : false,
  },
  plugins: [
    typescript({
      // Scoped to this plugin's own bundling pass, not the shared
      // tsconfig.json used by `tsc --noEmit` - that one now also covers
      // test/**/*.ts, which sits outside `src`, so rootDir/outDir can't
      // live in the shared config without tsc rejecting the test files as
      // "outside rootDir".
      compilerOptions: {
        rootDir: 'src',
        outDir: 'dist',
      },
    }),
    resolve(),
    dev && serve(serveopts),
    copy({
      targets: [
        { src: 'src/icons/*', dest: 'dist/icons' },
        { src: 'src/icons2/*', dest: 'dist/icons2' }
      ]
    })
  ],
};
