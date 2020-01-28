  // Sends a message as reponse to google. Includes memory in outputContext
  exports.sendMessage = function(messageArray, memory, continueSession, res){
    var def = deferred();

    var items = [];
    messageArray.forEach(function(msg){
      var res = {"simpleResponse": { 
          "textToSpeech": msg.content,
          "displayText": msg.content
        }
      }
      items.push(res);
    })

    var payload = {
      "payload": {
          "google": {
          "expectUserResponse": continueSession,
          "richResponse": {
              "items": items
          }
          }
      },
      "outputContexts": [
        {
          "name": "projects/save-data-df-js/agent/sessions/ABwppHGfFkWJdHKPpBEYiGkhdoakWmYj_2sZa4o8pbGG9nj4q5_GfDTtNEXOY34mLX8G4o_d7oZdUW9bnBZC/contexts/_actions_on_google",
          "lifespanCount": 99,
          "parameters": {
            "data": memory
          }
        }
      ]
        
  }
    res.send(payload);

    return def.promise();
  }