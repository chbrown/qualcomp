BIN := node_modules/.bin
TYPESCRIPT := $(shell jq -r '.files[]' tsconfig.json | grep -Fv .d.ts)

all: $(TYPESCRIPT:%.ts=%.js) build/bundle.js

$(BIN)/tsc $(BIN)/webpack:
	npm install

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

build/bundle.js: webpack.config.js app.js site.less $(BIN)/webpack
	mkdir -p $(@D)
	NODE_ENV=production $(BIN)/webpack --config $<
