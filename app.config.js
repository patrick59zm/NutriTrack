// Settings that depend on the build go here; everything else lives in app.json.
// CI sets ANDROID_VERSION_CODE so each published APK installs as an update of the last one.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE || 1),
  },
});
