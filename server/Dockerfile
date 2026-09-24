FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./

# Mount a persistent volume here, otherwise the shop must re-scan the QR
# after every restart or redeploy.
ENV DATA_DIR=/data
VOLUME ["/data"]

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
