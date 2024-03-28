FROM node:20

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY tsconfig.json ./
COPY public/ ./public/
COPY src/ ./src/

RUN yarn && yarn cache clean --force

EXPOSE 8000

ENTRYPOINT ["yarn"]

CMD ["start"]
