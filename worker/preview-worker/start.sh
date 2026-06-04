#!/bin/sh
# Worker must boot with a clean Node process — never inherit Railway/Nixpacks NODE_OPTIONS.
unset NODE_OPTIONS
export NODE_OPTIONS=
exec node dist/index.js
