const { JSDOM } = require('jsdom');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('UI integration tests', function() {
  this.timeout(5000);

  let dom, window, document;

  beforeEach(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    window = dom.window;
    document = window.document;
    // wait briefly for scripts to execute
    await new Promise(r => setTimeout(r, 300));
  });

  afterEach(() => {
    if (dom) dom.window.close();
  });

  it('exposes createMarkersForComponents and loadFlightById', () => {
    expect(window.createMarkersForComponents).to.be.a('function');
    expect(window.loadFlightById).to.be.a('function');
  });

  it('createMarkersForComponents clears markers when called without aircraftModel', () => {
    // ensure aircraftModel is not set
    window.aircraftModel = null;
    window.markers = [{id:1}];
    window.markerAnchors = [{a:1}];
    window.markerColliders = [{c:1}];
    window.pendingMarkerCreate = null;
    window.createMarkersForComponents([], 100);
    expect(window.pendingMarkerCreate).to.be.an('object');
    expect(window.markers.length).to.equal(0);
  });

});
