  // sends a message as a response to an Alexa request
  exports.sendMessage = function(messageArray, memory, endSession, alexaRes){
    var def = deferred();

      alexaRes.send({
        "version": alexaRes.version,
        "sessionAttributes":memory,
        "response":{
          "outputSpeech":{
            "type":"PlainText",
            "text":messageArray[0].content,
            "playBehavior":"ENQUEUE"
          },
          "shouldEndSession":endSession
        }
      });
      def.resolve();

    return def.promise();
  }

  // Sends a message that ends the conversation as a response to an Alexa request
  exports.endAlexaConversation = function(messageArray, alexaRes){
    var def = deferred();
    
      
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
      
      
    return def.promise();
  }