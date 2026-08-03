const path = require('path');
const { rspack } = require('@rspack/core');

module.exports = (env, options) => {
  const { mode = 'development' } = options;
  const prod = mode === 'production';
  const isDev = process.env.DEV_MODE === 'true';
  const devHost = process.env.DEV_HOST || '';
  const devPort = process.env.DEV_PORT || '';
  const devProto = isDev ? (process.env.DEV_PROTO || '') : '';
  const devOrigin = isDev && devHost && devPort && devProto
    ? ''.concat(devProto, '://', devHost, ':', devPort)
    : '';

  const rules = [
    // TypeScript/TSX files - Custom JSX loader + SWC
    {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: false,
              },
              target: 'es2015',
            },
          },
        },
        path.resolve(__dirname, 'utils/custom-loaders/html-tag-jsx-loader.js'),
      ],
    },
    // JavaScript files
    {
      test: /\.m?js$/,
      oneOf: [
        // Node modules - use builtin:swc-loader only
        {
          include: /node_modules/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                  },
                  target: 'es2015',
                },
              },
            },
          ],
        },
        // Source JS files - Custom JSX loader + SWC (JSX will be removed first)
        {
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                    jsx: false,
                  },
                  target: 'es2015',
                },
              },
            },
            path.resolve(__dirname, 'utils/custom-loaders/html-tag-jsx-loader.js'),
          ],
        },
      ],
    },
    // Handlebars and Markdown files
    {
      test: /\.(hbs|md|sh)$/,
      type: 'asset/source',
    },
    // Module CSS/SCSS (with .m prefix)
    {
      test: /\.m\.(sa|sc|c)ss$/,
      use: [
        'raw-loader',
        'postcss-loader',
        'sass-loader',
      ],
      type: 'javascript/auto',
    },
    {
      test: /\.svg$/,
      resourceQuery: /raw/,
      type: 'asset/source',
    },
    {
      test: /\.(png|svg|jpg|jpeg|ico|webp)(\?.*)?$/,
      resourceQuery: /inline/,
      type: 'asset/inline',
    },
    // Asset files
    {
      test: /\.(png|svg|jpg|jpeg|ico|ttf|webp|eot|woff|webm|mp4|wav|wasm)(\?.*)?$/,
      resourceQuery: { not: [/raw/, /inline/] },
      type: 'asset/resource',
    },
    // Regular CSS/SCSS files
    {
      test: /\.(?<!\.m\.)(sa|sc|c)ss$/,
      type: 'javascript/auto',
      use: [
        rspack.CssExtractRspackPlugin.loader,
        'css-loader',
        'postcss-loader',
        'sass-loader',
      ],
    },
  ];

  const main = {
    mode,
    entry: {
      boot: './src/boot.js',
      main: './src/main.js',
      console: './src/lib/console.js',
      searchInFilesWorker: './src/sidebarApps/searchInFiles/worker.js',
      searchIndexWorker: './src/sidebarApps/searchInFiles/indexWorker.js',
    },
    output: {
      path: path.resolve(__dirname, 'www/build/'),
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      assetModuleFilename: '[name][ext]',
      publicPath: devOrigin ? ''.concat(devOrigin, '/build/') : '/build/',
      clean: !isDev,
    },
    module: {
      rules,
      parser: {
        javascript: {
          exportsPresence: 'error',
          requireAlias: false,
        },
      },
    },
    optimization: {
      // Default CSS minimizer (LightningCSS) was stripping the icon fonts'
      // @font-face rules entirely in production builds - they're only ever
      // referenced via an inherited `font-family` on a parent class, not
      // directly on the same selector, which apparently reads as "unused"
      // to its optimizer. JS still gets minified normally; only the CSS
      // minimizer is disabled (CSS is a small fraction of this bundle's
      // size regardless).
      minimizer: prod ? [new rspack.SwcJsMinimizerRspackPlugin()] : undefined,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      fallback: {
        path: require.resolve('path-browserify'),
        crypto: false,
      },
      modules: ['node_modules', 'src'],
      roots: [],
    },
    plugins: [
      new rspack.DefinePlugin({
        __DEV_MODE__: JSON.stringify(isDev),
        __DEV_HOST__: JSON.stringify(devHost),
        __DEV_PORT__: JSON.stringify(devPort),
        __DEV_PROTO__: JSON.stringify(devProto),
      }),
      new rspack.CssExtractRspackPlugin({
        filename: '[name].css',
      }),
      // css-loader/postcss-loader prepend a BOM (U+FEFF) to each CSS module's
      // output. When CssExtractRspackPlugin concatenates multiple modules into
      // one file, only the very first module's BOM lands at byte 0 (harmless,
      // stripped by any UTF-8 decoder) - every other module's BOM ends up
      // sitting mid-stream, directly before that module's first rule. A
      // mid-stream U+FEFF isn't CSS whitespace, so it breaks the parser's
      // recognition of an immediately-following at-rule: this is exactly why
      // the icon fonts' @font-face rules were silently dropped from the
      // page's CSSOM (confirmed via postcss.parse() reproducing the same
      // drop on a minimal `}﻿@font-face{...}` snippet) even though the
      // rule was present, correctly formed, byte-for-byte, in the built file.
      {
        apply(compiler) {
          compiler.hooks.compilation.tap('StripMidStreamBOM', (compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'StripMidStreamBOM',
                stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
              },
              (assets) => {
                for (const name of Object.keys(assets)) {
                  if (!name.endsWith('.css')) continue;
                  const source = compilation.getAsset(name).source.source().toString();
                  if (!source.includes('﻿')) continue;
                  compilation.updateAsset(
                    name,
                    new rspack.sources.RawSource(source.replace(/﻿/g, '')),
                  );
                }
              },
            );
          });
        },
      },
    ],
  };

  return [main];
};
