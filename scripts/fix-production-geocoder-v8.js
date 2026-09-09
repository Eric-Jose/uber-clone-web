const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'backend', 'routes', 'location.js');
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf("router.get('/search'");
const end = source.indexOf('\nrouter.use(authenticate);', start);
if (start < 0 || end < 0) throw new Error('Location search route not found');

let route = source.slice(start, end);
route = route.replace("limit: '30'", "limit: '50'");
route = route.replace("maxLocations: '30'", "maxLocations: '50'");
route = route.replace("  const localQueries = [\n    query + ' Maracaju MS',\n    query + ' Maracaju Mato Grosso do Sul',\n  ];", `  const categoryMap = [
    { re: /^mercad/i, terms: ['mercado', 'supermercado', 'mercearia'] },
    { re: /^super\s*mercad/i, terms: ['supermercado', 'mercado', 'mercearia'] },
    { re: /^hospital/i, terms: ['hospital', 'pronto atendimento', 'hospitalar'] },
    { re: /^farm[aá]cia/i, terms: ['farmacia', 'drogaria', 'farmácia'] },
    { re: /^drogari/i, terms: ['drogaria', 'farmacia', 'farmácia'] },
    { re: /^posto/i, terms: ['posto', 'posto de combustivel', 'posto de combustível'] },
    { re: /^hotel/i, terms: ['hotel', 'pousada'] },
    { re: /^restaur/i, terms: ['restaurante', 'lanchonete', 'churrascaria'] },
    { re: /^padari/i, terms: ['padaria', 'panificadora'] },
  ];
  const matchedCategory = categoryMap.find((item) => item.re.test(normalized));
  const categoryTerms = matchedCategory ? matchedCategory.terms : [query];
  const localQueries = [];
  for (const term of categoryTerms) {
    localQueries.push(term + ' Maracaju MS');
  }
  localQueries.push(query + ' Maracaju MS', query + ' Maracaju Mato Grosso do Sul');`);
route = route.replace("      .slice(0, 20);", "      .slice(0, 40);");
if (!route.includes("const matchedCategory")) throw new Error('Category search patch did not apply');
source = source.slice(0, start) + route + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('[fix-production-geocoder-v8] Maracaju category searches expanded for markets, hospitals, pharmacies and similar POIs.');
