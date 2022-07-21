module.exports = {
  pluginOptions: {
    s3Deploy: {
      registry: undefined,
      awsProfile: 'default',
      overrideEndpoint: false,
      region: 'us-west-2',
      bucket: 'alpha.l2bridge.finance',
      createBucket: true,
      staticHosting: true,
      staticIndexPage: 'index.html',
      staticErrorPage: 'index.html',
      assetPath: 'dist',
      assetMatch: '**',
      deployPath: '/',
      acl: 'public-read',
      pwa: false,
      enableCloudfront: true,
      pluginVersion: '4.0.0-rc3',
      uploadConcurrency: 5,
      cloudfrontId: 'E2BGUBRW276S3I',
      cloudfrontMatchers: '/*',
    },
  },
  configureWebpack:{
    optimization: {
      splitChunks: {
        minSize: 1024000,
        maxSize: 1024000,
      }
    }
  },
  productionSourceMap: false,
  publicPath: '/',
  runtimeCompiler: true,
};
