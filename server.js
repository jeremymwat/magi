/**
 * Module dependencies
 */

var express = require('express'),
  path = require('path'),
  favicon = require('serve-favicon'),
  logger = require('morgan'),
  compress = require('compression'),
  methodOverride = require('method-override'),
  bodyParser = require('body-parser'),
  multer = require('multer'),
  errorHandler = require('errorhandler'),
  cookieParser = require('cookie-parser'),
  cookieSession = require('cookie-session'),
  Database       = require('./model/db'),
  mongoose = require('mongoose'),
  config   = require('./oauth2.js'),
  passport = require('passport'),
  jsdom    = require('jsdom'),
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var app = module.exports = express();

// Use moment for keeping track of times
app.locals.moment = require('moment');
app.locals.production = app.get('env') === 'production';

// Set the feedback widget ID based on whether we are in dev or production
app.locals.webengageID = app.get('env') === 'production' ? '~13410664b' : '~47b66aaa';

// Load models to register their schemas
var user = require( './model/user' ),
    database = require( './model/datasets' ),
    domains = require( './model/domains' ),
    ppis = require( './model/ppis' ),
    log = require('./model/log'),
    logPermission = require('./model/logPermission'),
    queryHash = require('./model/queryHash');

// Enable or disable interaction logging
log.enableLogging(false);

/**
 * Configuration
 */
// passport
// Serialize/Deserialize the user
var User = Database.magi.model( 'User' );
passport.serializeUser(function(user, done) {
  done(null, user.googleId);
});

passport.deserializeUser(function(id, done) {
 User.findOne({ googleId: id}, function(err, user){
     if(!err) done(null, user);
     else done(err, null)
 })
});

// development only
if (app.get('env') === 'development') {
  app.use(errorHandler());
  app.set('site url', 'http://localhost:8000/')
}

// production only
if (app.get('env') === 'production') {
  // TODO
  app.set('site url', 'http://magi.cs.brown.edu/')
};

// config passport to use Google OAuth2
passport.use(new GoogleStrategy({
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: app.get('site url') + config.google.callbackURLSuffix
  },
  function(token, tokenSecret, profile, done) {
    User.findOne({ googleId: profile.id }, function (err, user) {
      if (err) console.log( err );
      if (!user) var user = new User();

      // Store the user's full name, and his/her first email
    user.name     = profile.name.givenName + " " + profile.name.familyName;
    user.email    = profile.emails[0].value;
    user.googleId = profile.id;

    // Save/Update the user
    user.save(function(err){
      if (err) done(err, null);
      else done(err, user);
    });
    });
  }
));

// all environments
app.set('port', process.env.PORT || 8000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(compress());
app.use(logger('dev'));
app.use(cookieParser());
app.use(cookieSession({
  secret: 'magi_for_president!',
  cookie: { maxAge: 60 * 60 * 1000 * 24 } // store for three days
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(multer());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());

/**
 * Routes
 */
var routes = require( './routes/router' );

// Index page and query handler
app.get('/', routes.index);
app.post('/', routes.queryhandler)

// gd3 view
app.get('/view', routes.view)
app.get('/view/:id', routes.view)

// Data-/gene set uploads
app.post('/upload/geneset', routes.uploadGeneset)
app.get('/upload', ensureAuthenticated, routes.upload)
app.post('/upload/dataset', ensureAuthenticated, routes.uploadDataset)
app.get('/delete/dataset', ensureAuthenticated, routes.deleteDataset)
app.post('/upload/cancer', routes.uploadCancer)

// Dataset views
app.get('/datasets', routes.datasets.index);
app.get('/datasets/view/:datasetID', routes.datasets.view);

// Annotation views
app.get('/annotations/gene/:gene', routes.annotations.gene);
app.get('/annotations/cancer/:cancer', routes.annotations.cancer);
app.post('/save/annotation', ensureAuthenticated, routes.annotations.save);
app.post('/vote/ppi', ensureAuthenticated, routes.annotations.ppiVote);
app.post('/comment/ppi', ensureAuthenticated, routes.annotations.ppiComment);
app.post('/vote/mutation', ensureAuthenticated, routes.annotations.mutationVote);

// more information
app.get('/terms', routes.terms)
app.get('/contact', routes.contact)
app.get('/support', routes.support)
app.get('/privacy', routes.privacy)
app.get('/acknowledgements', routes.acknowledgements)
app.get('/cancers', routes.cancers)

// set up the authentication routes
app.get('/login', routes.login);
app.get('/logout', routes.logout);
app.get('/account', ensureAuthenticated, routes.account);
app.post('/user/update', ensureAuthenticated, routes.user.update)

// Render errors
app.get("/401", function(req, res){
  var msg = req.session.msg401;
  req.session.msg401 = null;
  res.render("401", {msg: msg});
})

// this route extracts the previous url (returnTo) and stores it in the session
// so it will get rerouted on authentication
app.get('/auth/google/returnTo', function(req, res){
  console.log(req.header('Referer'))
  var backURL = req.header('Referer') || '/account';
  req.session.returnTo = backURL;
  res.redirect('/auth/google');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                            'https://www.googleapis.com/auth/userinfo.email'] }),
  function(req, res){});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }), function(req, res) {
    var redirectTo = req.session.returnTo || '/account';
    delete req.session.returnTo;
    res.redirect(redirectTo);
  }
);

// Set up SEO routes
app.get('/google6c3c5c73e7e145cc.html', function(req, res) {
    res.sendfile('seo/google6c3c5c73e7e145cc.html');
});
app.get('/BingSiteAuth.xml', function(req, res) {
    res.sendfile('seo/BingSiteAuth.xml');
});
app.get('/sitemap.xml', function(req, res) {
    res.sendfile('seo/sitemap.xml');
});

// Save share hash URI
app.post('/share', routes.saveShareURL);

// Session logging
app.post('/startLog', routes.startLog);
app.post('/extendLog', routes.extendLog);
app.get('/logEnabled', routes.isLoggingEnabled);
app.post('/logConsent', routes.logConsent);
app.post('/userGaveConsent', routes.userGaveConsent);


// redirect all others to the index (HTML5 history)
//app.get('*', routes.index);

// Function that tests authentications
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  else{
    req.session.returnTo = req.path;
    res.redirect('/login');
  }
}

/**
 * Save image response functions
 */

// Handle save figure requests
app.post('/saveSVG', function(req, res) {
  if(req.body['html'] != undefined) {
    res.send(req.body['html']);
  } else if (req.body['img'] != undefined) {
    res.writeHead(200, {'Content-Type': 'image/png' });
    res.end(req.body['img'], 'binary');
    res.send();
  }
});

// Not needed as of the moment; delete if not needed for PDF generation
function saveSVG(req, res) {
  var bowerDir = 'public/components/',
      fileName = req.body['fileName'],
      svgHTML = req.body['html'];

  // run the jsdom headless browser
  var runHeadless = function (errors, window) {
    var svg = window.d3.select('svg');
    svg.attr('xmlns', 'http://www.w3.org/2000/svg')
         .attr('xmlns:xlink','http://www.w3.org/1999/xlink');
    var svgNode = svg.node();

    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-type', 'application/pdf');//'image/svg+xml');

    res.send('complete');

    console.log('----')
    console.log((svgNode.outerHTML).substring(0, 120));
    console.log('Size of svgNode: ' + Buffer.byteLength(svgNode.outerHTML, 'utf8') + " bytes");
    console.log(typeof svgNode.outerHTML);
  };

  jsdom.env(svgHTML,[bowerDir+'d3/d3.js', bowerDir+'jquery/dist/jquery.js'], runHeadless);
}

/**
 * Start Server
 */

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
