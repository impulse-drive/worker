FROM docker:stable-dind
RUN apk --no-cache add nodejs yarn
COPY . /app/
WORKDIR /app/
RUN yarn install
ENTRYPOINT ["/app/entrypoint"]


