BIN := node_modules/.bin
DTS := node/node angularjs/angular jquery/jquery async/async

all: ui/bundle.js ui/bundle.min.js ui/site.css

type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)
type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/borisyankov/DefinitelyTyped/master/$* > $@

$(BIN)/%:
	npm install

%.css: %.less $(BIN)/lessc $(BIN)/cleancss
	$(BIN)/lessc $< | $(BIN)/cleancss --keep-line-breaks --skip-advanced -o $@

%.min.js: %.js
	closure-compiler --angular_pass --language_in ECMASCRIPT5 --warning_level QUIET $< >$@

ui/bundle.js: ui/app.js $(BIN)/webpack
	mkdir -p $(@D)
	$(BIN)/webpack $< $@

dev: $(BIN)/watsh
	$(BIN)/watsh 'make ui/site.css' ui/site.less
