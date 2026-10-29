FROM node:22-alpine
RUN apk add --no-cache smartmontools
WORKDIR /agent
COPY lib.mjs agent.mjs ./
CMD ["node", "agent.mjs"]
