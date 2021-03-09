/*
 * Check for basic webgl support.  We may want to check for required extensions as well.
*/
export default function () {
  // https://github.com/Modernizr/Modernizr/blob/94592f279a410436530c7c06acc42a6e90c20150/feature-detects/webgl.js
  return 'WebGLRenderingContext' in window;
}
