FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d
WORKDIR /deps
COPY platform/templates/prototype/package.json platform/templates/prototype/package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force
COPY platform/runner/build.mjs /runner/build.mjs
ENV NODE_ENV=production STORYBOOK_DISABLE_TELEMETRY=1
WORKDIR /tmp/work
CMD ["node", "/runner/build.mjs"]
