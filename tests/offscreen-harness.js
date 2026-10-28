'use strict';
// The media implementation runs in a plain test page without extension APIs.
globalThis.chrome={runtime:{onMessage:{addListener(){}}}};
