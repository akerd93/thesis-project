
// Prints memory in console (Dev function)
exports.printMemory = function(conversationToken){
    build.getConversation(userslug, botslug, version, conversationToken)
    .then(function(res) {
      console.log(res.body.results.memory);
    })
  }
  
// Returns current memory for a conversation
exports.getMemory = function(conversationToken){
    var def = deferred();
    build.getConversation(userslug, botslug, version, conversationToken)
    .then(function(res) {
      def.resolve(res.body.results.memory);
    })
    return def.promise();
  }

  // Returns all parameters of a conversation (including memory, userids etc)
  exports.getConversation = function(conversationToken){
    var def = deferred();
    build.getConversation(userslug, botslug, version, conversationToken)
    .then(function(res) {
      def.resolve(res);
    })
    return def.promise();
  }

  // Sends multiple messages at once
  // Can also send responses to alexa and google for variant 2
  exports.sendMessageArray = function(messageArray, conversationToken, taskSummary, source, res){
    var def = deferred();
    
    this.getMemory(conversationToken).done(function(curMemory){;
      messageArray.forEach(function(x){
        console.log('Bot: ' + x);
        if(taskSummary){
          taskSummary.botAnswers.push(x);
        }
      });
      if(source == 'webchat'){
        request
            .post(`https://api.cai.tools.sap/connect/v1/conversations/${conversationToken}/messages`)
            .send({ messages: messageArray, conversation:[{memory:curMemory}] })
            .set('Authorization', authorizationToken)
            .end(function(err, res) {
              def.resolve();
          });
      }else if(source == 'alexa'){
        res.send({
          "version": res.version,
          "response":{
            "outputSpeech":{
              "type":"PlainText",
              "text":messageArray[0].content,
              "playBehavior":"ENQUEUE"
            },
            "shouldEndSession":false
          }
        });
        def.resolve();
      }else if(source == 'google'){
        res.send({
          "payload": {
              "google": {
              "expectUserResponse": true,
              "richResponse": {
                  "items": [
                  {
                      "simpleResponse": {
                          "textToSpeech": messageArray[0].content,
                          "displayText": messageArray[0].content
                      }
                  }
                  ]
              }
              }
          }
      });
      }
    });
      
      
    return def.promise();
  }

  // Ends alexa conversation for variant 2
  exports.endAlexaConversation = function(messageArray, conversationToken, taskSummary, source, alexaRes){
    var def = deferred();
    
    this.getMemory(conversationToken).done(function(curMemory){;
      
        alexaRes.send({
          "version": alexaRes.version,
          "response":{
            "outputSpeech":{
              "type":"PlainText",
              "text":messageArray[0].content,
              "playBehavior":"ENQUEUE"
            },
            "shouldEndSession":true
          }
        });
        def.resolve();
    });
      
      
    return def.promise();
  }
  
  // Updates memory with one or multiple parameters - depends if key and value variables are arrays
exports.updateMemory = function(key, value, conversationToken){
    var def = deferred();
    var curMemory = {};
    this.getMemory(conversationToken).done(function(curMemory){
      if(key.constructor === Array && value.constructor === Array){
        for(var i = 0; i < key.length; i++){
          curMemory[key[i]] = value[i];
        }
      }else{
        curMemory[key] = value;
      }
      build.updateConversation(userslug, botslug, version, conversationToken, { memory:curMemory }).then(function(res){
        def.resolve();
      });
    })
  
    return def.promise();
  }

  // Writes a summary of the current task (user input, bot replies) to a history parameter in the memory  
exports.updateHistory = function(conversationToken, taskSummary){
    var def = deferred();
  
    this.getMemory(conversationToken).done(function(curMemory){
      if(curMemory.history == null){
        curMemory.history = [];
      }
      curMemory.history.push(taskSummary);
      build.updateConversation(userslug, botslug, version, conversationToken, { memory:curMemory }).then(function(res){
        //getMemory(conversationId).then(function(result){console.log(result)})
        def.resolve();
      });
    })
  
    return def.promise();
  }
  
  // deletes a single memory key
exports.deleteMemoryKey = function(key, conversationToken){
    var def = deferred();
  
    this.getMemory(conversationToken).done(function(curMemory){
      if(key.constructor === Array){
        key.forEach(function(a){
          delete curMemory[a];
        });
      }else{
        delete curMemory[key];
      }
      build.updateConversation(userslug, botslug, version, conversationToken, { memory:curMemory }).then(function(res){
        //getMemory(conversationId).then(function(result){console.log(result)})
        def.resolve();
      });
    });
  
    return def.promise();
  }
  
  // Clears the entire memory (developer function) - usually history should never be cleared
exports.clearMemory = function(conversationToken){
    var def = deferred();
    build.updateConversation(userslug, botslug, version, conversationToken, { memory:{}})
      .then(function(res) {
        def.resolve();
    })
  
    return def.promise();
  }