// packages
const express = require('express')
const bodyParser = require('body-parser')
var path=require('path');
sapcai = require('sapcai').default
request = require('superagent')
deferred = require('deferred');

// modules
caiApi = require('./modules/caiApi.js')
weatherApi = require('./modules/weatherApi.js')
alexaApi = require('./modules/alexaApi.js')
googleApi = require('./modules/googleApi.js')
sqlFunctions = require('./modules/sqlFunctions.js')
contentApi = require('./modules/mockApi.js')
sharedFunctions = require('./modules/sharedFunctions.js')
workflowFunctions = require('./modules/workflowFunctions.js')
productFunctions = require('./modules/productFunctions.js')

// jsdom and jQuery package
jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;

$ = jQuery = require('jquery')(window);

const app = express() 

// Production port
 const port = process.env.PORT || 5000;

// Development port
// const port = 5010 

app.use(bodyParser.json(), function(req, res, next) {
  // Pass to next layer of middleware
  next();
});

caiConfig = require('./config.json')

// SAP CAI configuration
client = new sapcai(caiConfig.developerToken)
build = client.build
authorizationToken = caiConfig.authorizationToken
developerToken = caiConfig.developerToken
botslug = caiConfig.botslug
version = caiConfig.version
userslug = caiConfig.userslug

// Endpoint for GET / requests
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

// Endpoint for POST / requests
app.post('/', (req, res) => {
  var conversationToken;
  var channel;

    var memory;
    var messageContent;
    var conversationToken;
    var source;
    var alexaRes = null;
    var sessionEnded = false;

    // Detect input device
    // Alexa requests do not have "nlp" parameter in body
    if(req.body.request && !req.body.nlp){
      try{
        // This is for variant 2 of Alexa, therefore CATCH_ALL_SLOT has to exist
        messageContent = req.body.request.intent.slots.CATCH_ALL_SLOT.value;
        conversationToken = req.body.session.sessionId.split('.session.')[1];
        
        source = "alexa";
        alexaRes = res;
        alexaRes.version = req.body.version;
        alexaRes.token = req.body.session.sessionId;
        // Alexa sends session ended requests without user input when a conversation ends
        if(req.body.request.type == 'SessionEndedRequest'){
          sessionEnded = true;
        }
      }
      catch(e){
        
      }
    }else{
      // If nlp parameter in body exists, source is webchat
      messageContent = req.body.message.attachment.content;
      conversationToken = req.body.chatId;
      source = "webchat";
      res.sendStatus(200);
    }
    if(!sessionEnded){
      // Send input to SAP CAI chatbot for NLP analysis
      build.dialog({ type: "text", content: messageContent},{ conversationId: conversationToken })
        .then(function(res) {
        var skill = res.conversation.skill;
        var memory = res.conversation.memory;
        res.source = source;
        
        if(skill=='finish-conversation'){
          memory.awaitInput = '';
        }

        // Ensures that user input is used for the current task
        if(memory.awaitInput == 'functionChoice' && skill != 'repeat-last-message' && skill != 'weather'){
          skill = 'function-choice';
        }else if (memory.awaitInput == 'chapterChoice' && memory.functionResults && skill != 'repeat-last-message' && skill != 'weather'){
          skill = 'function-chapter'
        }else if(memory.awaitInput == 'workflowChoice' && memory.workflowResults && skill != 'repeat-last-message' && skill != 'weather'){
          skill = 'workflow-choice';
        }else if(memory.awaitInput == 'workflowChapter' && skill != 'repeat-last-message' && skill != 'weather'){
          skill = 'workflow-result';
        }else if(memory.awaitInput == 'product-description' && skill != 'repeat-last-message' && skill != 'weather'){
          skill = 'search-product';
        }
        
        var taskSummary = {};
        taskSummary.userMessage = messageContent;
        taskSummary.skill = skill;
        taskSummary.botAnswers = [];

        // depending on the detected skill (or the next skill in line), different modules are called

        if(skill == "search-function"){
          sqlFunctions.search(res, conversationToken, taskSummary, alexaRes, source).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          });
        }

        if(skill == 'function-choice'){
          sqlFunctions.select(res, conversationToken, taskSummary, alexaRes, source).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          });
        }

        if(skill == 'function-chapter'){
          sqlFunctions.select_chapter(res, conversationToken, taskSummary, alexaRes, source).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          });
        }

        if(skill == 'search-product' && source != 'alexa' && source != 'google-assistant'){
          if(memory.awaitInput == "product-description"){
            productFunctions.search(res, conversationToken, taskSummary, alexaRes, source).done(function(){
              caiApi.updateHistory(conversationToken, taskSummary);
           });
          }else{
            caiApi.updateMemory("awaitInput","product-description", conversationToken).done(function(){
              caiApi.sendMessageArray(res.messages, conversationToken, taskSummary, source, alexaRes).done(function(){
                caiApi.updateHistory(conversationToken, taskSummary);
              });
            })
          }
        }else if(skill == 'search-product' && (source == 'alexa' || source == 'google-assistant')){
          var msg = [{'type':'text','content':'Product search is not available for voice devices. Please use this function in your web browser instead.'}];
          caiApi.sendMessageArray(msg, conversationToken, taskSummary,source, alexaRes).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          });
        }

        if(skill == 'search-workflow'){
            workflowFunctions.search(res, conversationToken, taskSummary, alexaRes, source, null).done(function(){
              caiApi.updateHistory(conversationToken, taskSummary);
            });
          }

        if(skill == 'workflow-choice'){
          workflowFunctions.select(res, conversationToken, taskSummary, alexaRes, source).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          })
        }

        if(skill == 'workflow-result'){
          workflowFunctions.select_chapter(res, conversationToken, taskSummary, alexaRes, source).done(function(){
            caiApi.updateHistory(conversationToken, taskSummary);
          })
        }

        if(skill == 'repeat-last-message'){
          caiApi.sendMessageArray(memory.history[memory.history.length-1].botAnswers, conversationToken, taskSummary, source, alexaRes).done(function(){
            // don't update the history here, because it was just a repeat
          })
        }

        // For weather, location and datetime is necessary
        if(skill == 'weather'){
          var location;
          var datetime;
          if(res.nlp.entities.datetime){
            datetime = res.nlp.entities.datetime[0];
          }else{
            datetime = new Date();
          }
          if(res.nlp.entities.location){
            location = res.nlp.entities.location[0];
          }
          weatherApi.getWeather(datetime,location).done(function(resMsg){
            var messages = [{ type:"text", content:resMsg}];
            caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(){
              caiApi.updateHistory(conversationToken, taskSummary);
            })
          })
          
        }

        // finish-conversation ends a conversation and deletes all memory keys besides history
        if(skill == 'finish-conversation'){
          caiApi.deleteMemoryKey(["workflowResults","awaitInput","searchObjective","orderedResults","workflowName","workflow","chapters","functionResults","functionName","sqlFunc"], conversationToken).done(function(){
            var messages = [{content:"Let me know if you need anything else.", type:"text"}]
            if(source == 'alexa'){
              caiApi.endAlexaConversation(messages, conversationToken, taskSummary, source, alexaRes).done(function(){
                caiApi.updateHistory(conversationToken, taskSummary);
              })
            }else{
              caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(){
                caiApi.updateHistory(conversationToken, taskSummary);
              })
            }
          })
          
        }
      })
    }
    
});

// Endpoint for POST /alexa
app.post('/alexa', (req, res) => {
  // Alexa sends Launchrequests when a user uses the skill invocation
  if(req.body.request.type == 'LaunchRequest'){
    // Greets the user
    var message = [{type:'text', content:'You can ask me a question about workflows!'}]
    alexaApi.sendMessage(message, {}, false, res);
  // When an intent is detected, an IntentRequest is sent
  }else if(req.body.request.type == 'IntentRequest'){
      var intent = req.body.request.intent.name;
      var alexaRes = res;
      var source = 'alexa';
      var conversationToken = req.body.session.sessionId;
      var taskSummary = {};

      // Based on the intent, different functions in the workflow module are called
      if(intent == 'searchWorkflow'){
        workflowFunctions.search(res, conversationToken, taskSummary, alexaRes, source, req);
      }else if(intent == 'AMAZON.YesIntent' || intent == 'AMAZON.NoIntent'){
        workflowFunctions.select(res, conversationToken, taskSummary, alexaRes, source, req);
      }else if(intent == 'chapter'){
        workflowFunctions.select_chapter(res, conversationToken, taskSummary, alexaRes, source, req);
      }else if(intent == 'finishConversation' || intent == 'AMAZON.CancelIntent'){
        var message = [{type:'text', content:'Let me know if you need anything else.'}]
        alexaApi.endAlexaConversation(message, res);
      }
  // Ends the session
  }else if(req.body.request.type == 'EndSessionRequest'){
      var message = [{type:'text', content:'Let me know if you need anything else.'}]
      alexaApi.endAlexaConversation(message, res);
  }
});

// Endpoint for POST /google
app.post('/google', (req, res) => {
  var conversationToken = req.body.session;
  var taskSummary = {};
  var source = 'google';

  // Google contains a variety of not-relevant information in their outputContexts
  // This extracts only the memory data
  var memory;
  var outputContexts = req.body.queryResult.outputContexts;
  for(var i =0; i<outputContexts.length; i++){
    if(outputContexts[i].parameters && outputContexts[i].parameters.data){
      memory = outputContexts[i].parameters.data;
      break;
    }
  }

  // based on the detected intent, different funcitons of the workflow module are called
  var intent = req.body.queryResult.intent.displayName;
  if(intent == 'searchWorkflow'){
    workflowFunctions.search(res, conversationToken, taskSummary, res, source, req);
  }else if(intent == 'searchWorkflow - yes' || intent == 'searchWorkflow - no'){
    workflowFunctions.select(res, conversationToken, taskSummary, res, source, req);
  }else if(intent == 'Default Fallback Intent' && memory && memory.awaitInput && memory.awaitInput == 'workflowChapter'){
    workflowFunctions.select_chapter(res, conversationToken, taskSummary, res, source, req);
  }else if(intent == 'finishConversation'){
    var message = [{type:'text', content:'Let me know if you need anything else.'}]
    googleApi.sendMessage(message, memory, false, res);
  }
})

app.listen(port, () => { 
  console.log('Server is running on port '+ port) 
})
