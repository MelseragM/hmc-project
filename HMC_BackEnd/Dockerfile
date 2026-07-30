# syntax=docker/dockerfile:1

############################
# 1) Base image
#    node:20-slim (Debian/glibc) is used instead of Alpine because
#    node-oracledb ships prebuilt binaries for glibc — avoids native builds.
############################
FROM node:20-slim AS base
WORKDIR /app

############################
# 2) Install ALL deps (incl. dev) — needed to compile TypeScript
############################
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

############################
# 3) Build TypeScript -> dist/ (nest build + tsc-alias)
############################
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

############################
# 4) Install production-only deps
############################
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

############################
# 5) Final runtime image
############################
FROM base AS runner
ENV NODE_ENV=production \
    PORT=443

# Copy production node_modules and compiled output, owned by the built-in
# non-root `node` user provided by the official image.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 443

# Container-native healthcheck (uses Node's global fetch — no curl needed).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||443)+'/'+(process.env.API_PREFIX||'api/v1')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main"]