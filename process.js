var fs = require('fs');
var osmium = require('osmium');

var file = new osmium.File(process.argv[2], 'pbf');
var reader = new osmium.Reader(file, {
    node: true,
    way: true
});
var location_handler = new osmium.LocationHandler();
var handler = new osmium.Handler();

var hdm = JSON.parse(fs.readFileSync('hdm.json', 'utf8'));

var hdmTags = [];
var hdmClasses = [];
var hdmLayers = [];

var tagClassAndLayer = {};
var hdmClassLayer = {};

function findPropertyFromTag(tag, layer) {
  for (var property in hdm[layer]) {
    if (hdm[layer].hasOwnProperty(property) && property !== "class") {
      for (value in hdm[layer][property]) {
        if (hdm[layer][property].hasOwnProperty(value)) {
          for (var i = 0; i < hdm[layer][property][value].length; i++) {
            if (hdm[layer][property][value].indexOf(tag) > -1) {
              return { "property" : property, "value" : value };
            }
          }
        }
      }
    }
  }
}

(function collectTags() {
  for (var layer in hdm) {
    if (hdm.hasOwnProperty(layer)) {
      hdmLayers.push(layer);
      for (classAttr in hdm[layer]["class"]) {
        if (hdm[layer]["class"].hasOwnProperty(classAttr)) {
          hdmClasses.push(classAttr);
          for (var i = 0; i < hdm[layer]["class"][classAttr].length; i++) {
            var osmTag = hdm[layer]["class"][classAttr][i];
            hdmTags.push(osmTag);
            tagClassAndLayer[osmTag] = { "class": classAttr, "layer": layer };
          }
        }
      }
    }
  }
})();

handler.options({ 'tagged_nodes_only' : true });

handler.on('node', filter);
handler.on('way', filter);

var wstreams = {};
for (var i = 0; i < hdmLayers.length; i++) {
  wstreams[hdmLayers[i]] = fs.createWriteStream('hdm-data/' + hdmLayers[i] + '.json');
}



function filter(item) {
  var tags = item.tags();
  var keys = Object.keys(tags);
  keys.forEach(function(key) {
    var candidate = key + '=' + tags[key];

    if ((hdmTags.indexOf(candidate) > -1)) {

      var layer = tagClassAndLayer[candidate].layer;
      var geometry = item.geojson();

      var properties = {};
      properties.class = tagClassAndLayer[candidate].class;

      if (findPropertyFromTag(candidate, layer)) {
        var otherProperties = findPropertyFromTag(candidate, layer);
        properties[otherProperties.property] = otherProperties.value;
      }

      //properties[type + '_id'] = item.id;
      wstreams[layer].write(
        JSON.stringify({
          'type': 'Feature',
          'properties': properties,
          'geometry': item.geojson()
        }) + "\n"
      );
    }
  });
}

osmium.apply(reader, location_handler, handler);
