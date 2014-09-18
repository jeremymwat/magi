// Functions for saving user interaction data
// For use in user studies

var loggingEnabled = false,
    MAGI_sessionLogStart,
    MAGI_interactionsLog = [],
    MAGI_resizes = {
      documentSize: [],
      windowSize: [],
      vizSizes: [],
      vizLocations: []
    };

$(window).resize(function() {
  var s = getSizes();
  MAGI_resizes.documentSize.push(s.documentSize);
  MAGI_resizes.windowSize.push(s.windowSize);
  MAGI_resizes.vizSizes.push(s.vizSizes);
  MAGI_resizes.vizLocations.push(s.vizLocations);
});

$(document).keydown(function(e) {
  if(e.ctrlKey || e.metaKey) {
    extendLogEvents();
  }
});

$(document).mousemove(function(e) {
  addToLog(e, 'm');
  if(e.pageX <= 0 || e.pageY <= 0) {
    console.log('outside');
    extendLogEvents();
  }
});

$(document).click(function(e) {
  addToLog(e, 'c');
});

$(document).scroll(function(e) {
  addToLog(e, 's');
});

$().ready(function () {
  interactionsLog = [];
  MAGI_sessionLogStart = Date.now();
  // Does the server enable logging?
  $.post('/userGaveConsent')
    .done(function(res) {
      loggingEnabled = res;
      if(loggingEnabled) startLog();
    });
});


function getSizes() {
  var time = Date.now();
  var documentSize = {width:$(document).width(), height:$(document).height()},
      windowSize = {width:$(window).width(), height:$(window).height()},
      vizSizes = {},
      vizLocs = {};

  // Get size and locations of visualizations
  vizSizes.mutmtx = {width:$('div#mutation-matrix').width(), height:$('div#mutation-matrix').height()};
  vizLocs.mutmtx = $('div#mutation-matrix').offset();
  vizSizes.subnet = {width:$('div#subnetwork').width(), height:$('div#subnetwork').height()};
  vizLocs.subnet = $('div#subnetwork').offset();
  vizSizes.trnant = {width:$('div#transcript-plot').width(), height:$('div#transcript-plot').height()};
  vizLocs.trnant = $('div#transcript-plot').offset();
  vizSizes.cnaviz = {width:$('div#cna-browser').width(), height:$('div#cna-browser').height()};
  vizLocs.cnaviz = $('div#cna-browser').offset();

  documentSize.time = time;
  windowSize.time = time;
  vizSizes.time = time;
  vizLocs.time = time;

  return {
    documentSize:documentSize,
    windowSize:windowSize,
    vizSizes:vizSizes,
    vizLocations:vizLocs
  };
}

function startLog() {
  var documentSize = {width:$(document).width(), height:$(document).height()},
      windowSize = {width:$(window).width(), height:$(window).height()},
      vizSizes = {},
      vizLocs = {};

  // Get size and locations of visualizations
  vizSizes.mutmtx = {width:$('div#mutation-matrix').width(), height:$('div#mutation-matrix').height()};
  vizLocs.mutmtx = $('div#mutation-matrix').offset();
  vizSizes.subnet = {width:$('div#subnetwork').width(), height:$('div#subnetwork').height()};
  vizLocs.subnet = $('div#subnetwork').offset();
  vizSizes.trnant = {width:$('div#transcript-plot').width(), height:$('div#transcript-plot').height()};
  vizLocs.trnant = $('div#transcript-plot').offset();
  vizSizes.cnaviz = {width:$('div#cna-browser').width(), height:$('div#cna-browser').height()};
  vizLocs.cnaviz = $('div#cna-browser').offset();

  // Get query information from address bar
  var pathTkns = window.location.search.split('&'),
      genes = pathTkns[0].replace('?genes=','').split('%2C'),
      datasets = pathTkns[1].replace('datasets=','').split('%2C'),
      showDuplicates = pathTkns[2].replace('showDuplicates=','');

  var now = MAGI_sessionLogStart;
  documentSize.time = now;
  windowSize.time = now;
  vizSizes.time = now;
  vizLocs.time = now;

  var log = {
    sessionId: now,
    documentSize: documentSize,
    windowSize: windowSize,
    vizSizes: vizSizes,
    vizLocations: vizLocs,
    genes: genes,
    datasets: datasets,
    showDuplicates: showDuplicates
  };

  $.post('/startLog', log);
}
function extendLogEvents() {
  var log = {};
  log.sessionId = MAGI_sessionLogStart;
  log.log = MAGI_interactionsLog;
  log.documentSize = MAGI_resizes.documentSize;
  log.windowSize = MAGI_resizes.windowSize;
  log.vizSizes = MAGI_resizes.vizSizes;
  log.vizLocations = MAGI_resizes.vizLocations;
  console.log(log);
  $.post('/extendLog', log);
  MAGI_interactionsLog = [];
}

function addToLog(e, event) {
  if (loggingEnabled == false) {
    return;
  }
  var x = e.pageX,
      y = e.pageY,
      time = Date.now();
  MAGI_interactionsLog.push({x:x, y:y, t:time, e:event});
}

function sendData() {
  if (loggingEnabled == false) {
    return;
  }
  var end = Date.now(),
      start = MAGI_sessionLogStart;

  var height = $(window).height(),
      width = $(window).width();

  var pathTkns = window.location.search.split('&'),
      genes = pathTkns[0].replace('?genes=','').split('%2C'),
      datasets = pathTkns[1].replace('datasets=','').split('%2C'),
      showDuplicates = pathTkns[2].replace('showDuplicates=','');

  var vizSizes = {};
  vizSizes.mutmtx = [$('div#mutation-matrix').width(), $('div#mutation-matrix').height()];
  vizSizes.subnet = [$('div#subnetwork').width(), $('div#subnetwork').height()];
  vizSizes.trnant = [$('div#transcript-plot').width(), $('div#transcript-plot').height()];
  vizSizes.cnaviz = [$('div#cna-browser').width(), $('div#cna-browser').height()];

  // TODO: log voting actions, log annotation generation
  var log = {
    datasets: datasets,
    end: end,
    genes: genes,
    height: height,
    log: JSON.stringify(interactionsLog),
    showDuplicates: showDuplicates,
    start: start,
    width: width,
    vizSizes: vizSizes
  };
  $.post('/saveLog', log);
}