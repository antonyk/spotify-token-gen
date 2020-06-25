/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

require('dotenv').config(/* add your dotenv options here */)
const url = require('url')
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

const client_id = process.env.CLIENT_ID || ''; // Your client id
const client_secret = process.env.CLIENT_SECRET || ''; // Your secret
const redirect_endpoint_path = "/callback/"

// var redirect_uri = 'http://localhost:8888/callback/'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {
  const redirect_uri = urlBuilder(req, redirect_endpoint_path)
  console.log(client_id, client_secret)

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  // const scopes = []
  const scope_user = `user-read-private user-read-email`
  const scope_fol = `user-follow-read user-follow-modify`
  const scope_hist = `usr-read-recently-played user-top-read user-read-playback-position`
  const scope_lib = `user-library-read user-library-modify`
  const scope_conn = `user-read-playback-state user-read-currently-playing user-modify-playback-state`
  const scope_playlist = `playlist-read-collaborative playlist-modify-private playlist-modify-public playlist-read-private`
  const scope_playback = `streaming app-remote-control`
  const scope_img = `ugc-image-upload`

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope_playlist + ' ' + scope_user + ' ' + scope_lib + ' ' + scope_fol,// + ' ' + scope_hist,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {
  const redirect_uri = urlBuilder(req, redirect_endpoint_path)

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        console.log("access: ", access_token, "refresh: ", refresh_token)

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

const PORT = process.env.PORT || 8888
console.log(`Listening on ${PORT}`);
app.listen(PORT);


function urlBuilder(req, path) {
  const baseUrl = url.format({
    protocol: req.protocol,
    host: req.get("host"),
    pathname: req.baseUrl
  })
  return baseUrl + path
}
