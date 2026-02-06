const fs = require('fs');
const j = JSON.parse(fs.readFileSync('src/config/flows/booking-quote-flow.json', 'utf8'));

j.version = '6.0';

// Remove conditional child age fields
const g = j.screens.find(s => s.id === 'GUESTS_SCREEN');
if (g) {
  g.layout.children = g.layout.children.filter(c => {
    if (c.name && c.name.startsWith('child_age')) return false;
    return true;
  });
}

// Update confirmation screen
const conf = j.screens.find(s => s.id === 'CONFIRMATION_SCREEN');
if (conf) {
  conf.layout.children = conf.layout.children.filter(ch => {
    if (ch.type === 'TextCaption' && ch.text && ch.text.indexOf('child_age') !== -1) return false;
    return true;
  });
  const footer = conf.layout.children.find(ch => ch.label === 'Confirmar');
  if (footer && footer['on-click-action'] && footer['on-click-action'].payload) {
    delete footer['on-click-action'].payload.child_age_1;
    delete footer['on-click-action'].payload.child_age_2;
    delete footer['on-click-action'].payload.child_age_3;
  }
}

fs.writeFileSync('src/config/flows/booking-quote-flow-simplified.json', JSON.stringify(j, null, 2));
console.log('OK');
