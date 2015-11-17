console.log("Starting Train of Thought bot");

var fs = require('fs');
var request = require('request');
var fotology = require('fotology');

function randomInt(min,max) {
    return Math.floor(Math.random()*(max-min+1)+min);
}

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    if(err) {
      console.log("Error downloading image")
    } else {
      request(uri).on('error', function(e) {
        console.log(e);
      }).pipe(fs.createWriteStream(filename))
      .on('close', callback)
    }
  });
};

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var getRelatedWords = function(word, callback, noWordsCallback) {
  var uri = 'http://api.wordnik.com:80/v4/word.json/' + word + '/relatedWords?useCanonical=true&relationshipTypes=same-context&limitPerRelationshipType=10&api_key=' + config.wordnikConfig.apikey;
  console.log("Word: " + word);
  request(uri, function (error, response, body) {
    if (!error && response.statusCode == 200) {

      var json = JSON.parse(body) [0];
      if(json !== undefined) {
          callback(json.words);
      } else {
        noWordsCallback();
      }
    }
  })
}



var imageDir = './images';
if(!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir);
}

var twit = require('twit');
var config = require('./config');

var T = new twit(config.twitConfig);

var searchOptions = {
  safe: false
}

var statuses = [
  "{0}? That reminds me of {1}",
  "Talking about {0}, did you hear about {1}?",
  "{0}? Lets think about {1}"
]

var currentThought = 'table';
var previousThought = 'chair';

if(fs.existsSync('.currentThought')) {
  currentThought = fs.readFileSync('.currentThought');
  console.log("Previous thought found: " + currentThought);
}

function thinkOf(thought) {
  previousThought = currentThought;
  currentThought = thought;

  fs.writeFileSync(".currentThought", currentThought);

  fotology(thought, searchOptions, function(urls) {
      var options = {
        url:  urls[randomInt(0, urls.length - 1)],
        timeout: 120000
      };

      download(options, imageDir + '/currentImage.png', function() {

        var base64image = fs.readFileSync(imageDir + '/currentImage.png', { encoding: 'base64' });

        T.post('media/upload', { media_data: base64image }, function (err, data, response) {

          var mediaIdStr = data.media_id_string
          var text = statuses[randomInt(0, statuses.length -1 )];
          var params = { status: text.format(previousThought, currentThought), media_ids: [mediaIdStr] }

          T.post('statuses/update', params, tweeted);
        });
    });
  });
}

function tweeted(err, data, response) {
  if(err) {
    console.log("Error posting tweet!");
    console.log(data);
  } else {
    console.log("Tweeted!");
  }
}

function foundWords(words) {
  var choice = randomInt(0, words.length - 1);
  thinkOf(words[choice]);
}

getRelatedWords(currentThought, foundWords, noWords);


function setRandomThought() {
  var uri = 'http://api.wordnik.com:80/v4/words.json/randomWord?hasDictionaryDef=true&minCorpusCount=0&maxCorpusCount=-1&minDictionaryCount=1&maxDictionaryCount=-1&minLength=5&maxLength=-1&api_key=' + config.wordnikConfig.apikey;

  request(uri, function (error, response, body) {
    if (!error && response.statusCode == 200) {

      var oldThought = currentThought;


      var json = JSON.parse(body);
      currentThought = json.word;

      T.post('statuses/update', {status: "I dont know what to think about " + oldThought + ". What about " + currentThought}, tweeted);

      getRelatedWords(currentThought, foundWords, noWords);
    }
  })

}

function noWords() {
  console.log("Getting random word");
  setRandomThought();
}

function think() {
  getRelatedWords(currentThought, foundWords, noWords);
}

setInterval(think, 1000 * 60 * 5);

//thinkOf("phone 2");
