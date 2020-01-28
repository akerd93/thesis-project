var parameters = {
  deliverable:"sqlfunctions"
};

// search function of sqlFunctions
exports.search = function(res, conversationToken, taskSummary, alexaRes, source){
    var def = deferred();
    // extract the entity sqlfunc
    var objective = res.nlp.entities.sqlfunc[0].raw;

    // as we primarily are looking for function results, add "function" to the objective
    if(!objective.toLowerCase().includes('function')){
      objective = objective + " Function";
    }

    var params = parameters;
    params.q = objective;

    var orderedResults = [];
    // call Help Portal API with objective
    contentApi.callElasticSearch(params).done(function(result){
      if(result && result.length>0){
        var memoryKeys = [];
        var memoryValues = [];
  
        var resultList = {};
        resultList.type = 'list';
        resultList.content = {};
        resultList.content.elements = [];
  
        var resultJson = {};
        // create a list of results from which the user can choose
        result.forEach(function (x){
          var curListElement = {};
          curListElement.buttons = [{ title:"More", type:"postback", value:x.title }];
          curListElement.subtitle = x.description;
          curListElement.title = x.title;
          curListElement.imageUrl = "";
          resultList.content.elements.push(curListElement);

          orderedResults.push(x.title);
          resultJson[x.title] = x;          
        });
  
        // add all results to memory
        memoryKeys.push("functionResults");
        memoryValues.push(resultJson);
  
        // set awaitInput parameter to functionChoice -> next input will be a choice of function
        memoryKeys.push("awaitInput");
        memoryValues.push("functionChoice");
  
        // add searchObjective to memory
        memoryKeys.push("searchObjective");
        memoryValues.push(objective);

        // add the ordered titles to memory
        memoryKeys.push("orderedResults");
        memoryValues.push(orderedResults);
  
        var messages = [];
        
        // For webchat, return text message + list
        // for alexa, add text messages to go through the results one by one until user confirms
        if(source=='webchat'){
          messages.push({type:"text",content:"Please choose a function:"});
          messages.push(resultList);
        }else if(source =='alexa'){
          var content = "I have found '" + orderedResults[0] + "'. Is that what you were looking for?"
          messages.push({type:"text", content:content})

        }

        // update the memory with all above parameters
        caiApi.updateMemory(memoryKeys,memoryValues,conversationToken).done(function(){
          // send all messages
          caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(req, res){
            def.resolve();
          });
        });
      }
    });
    return def.promise();
  }

  // once user selects one of the results (this is automatically called when awaitInput is functionChoice)
  exports.select = function(res, conversationToken, taskSummary, alexaRes, source){
    var def = deferred();
    
    var memory = res.conversation.memory;
    var choice = res.nlp.source;

    
    var intent = "";
    
    // detect the intent and take its value
    if(res.nlp.intents[0] && res.nlp.intents[0].slug){
      intent = res.nlp.intents[0].slug;
    }

    // if source is alexa, then the user has either confirmed or denied the result at spot 0 in the result array
    if(source == 'alexa'){
      if(intent == 'yes'){
        // if he confirmed, then the first result is his choice
        choice = memory.orderedResults[0];
      }else if(intent == 'no'){
        // if he denied, then the first result can be removed and the second one is offered to the user instead
        var newOrderedResults = [];
        for(i = 1; i < memory.orderedResults.length; i++){
          newOrderedResults.push(memory.orderedResults[i]);
        }
        var messages = [{type:'text',content:"Were you looking for '" + newOrderedResults[0]  + "' instead?"}];
        caiApi.updateMemory('orderedResults', newOrderedResults, conversationToken).done(function(){
          caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(){
            def.resolve();
          })
        })
      }
    }

      // if the user choice can be found within the results and the user has not denied
      if(memory.functionResults[choice] && intent != "no"){
        var sqlFunc = memory.functionResults[choice];
        var topic = sqlFunc.loio;
        var funcName = sqlFunc.title;
  
        var params = parameters;
        params.topic = topic;
        
        // send a request for the content of the chosen topic
            contentApi.callGetContent(params).done(function(result){
            // read the chapters
            var chapterObj = sharedFunctions.readChapters(result, funcName, sqlFunc.url);
    
            var messages = [];
  
            // provide different messages for alexa & webchat
            if(source=='alexa'){
              var msg = {};
              msg.type = 'text';
              msg.content = 'Which of the following chapters do you want first? ';
              chapterObj.chapters.forEach(function(chapter){
                msg.content += chapter + ", ";
              });
              msg.content = msg.content.substring(0, msg.content.length-2);
              messages.push(msg);
            }else{
              messages.push(chapterObj.msg);
            }
    
            // send the messages, update the memory
            caiApi.updateMemory(["functionName","awaitInput", "sqlFunc", "chapters"],[funcName,"chapterChoice",sqlFunc,chapterObj.chapters], conversationToken).done(function(){
              caiApi.sendMessageArray(messages, conversationToken, taskSummary, res.source, alexaRes).done(function(){
                  def.resolve();
                });
              });
          })
      }
    return def.promise();
  }

  // once the user selected a chapter
  exports.select_chapter = function(res, conversationToken, taskSummary, alexaRes, source){
    var def = deferred();
  
    var memory = res.conversation.memory;
    // selected chapter is raw input
    var chapter = res.nlp.source;
    var topic = memory.sqlFunc.loio;
    var sqlFunc = memory.sqlFunc;

    var params = parameters;
      params.topic = topic;

      // call the content api for the topic
      contentApi.callGetContent(params).done(function(result){
        // parse the HTML, extract t he chapter
        var html = $(result.content);
        var parserResult = sharedFunctions.parseHtml(html, chapterFound, chapter, "sqlFunctions");
        var chapterFound = parserResult.chapterFound;
        var messages = parserResult.messages;
        // if the chapter could not be found, inform the user
        if(!chapterFound){
          if(source != 'alexa'){
            var msg = {
              "type": "buttons",
              "content": {
                "title": "Sorry, that chapter was not found. Do you want to open the page?",
                "buttons": [
                  {
                    "title": "Open page",
                    "type": "web_url",
                    "value": "https://help.sap.com"+sqlFunc.url
                  }
                ]
              }
            }
            messages.push(msg);
          }
          else{
            messages = [{content:"Sorry, I could not find that chapter.", type:"text"}]
          }
          
        }

        // Remove images if source is alexa and google, or add path to images if it's webchat.
        var newMessages = [];
        messages.forEach(function(message){
          if(message.type=='card'){
            if(source == 'alexa' || source == 'google'){
              // do nothing to remove them from answers - google and alexa can't display images
            }else{
              // add imagepath
              var url = "https://help.sap.com/doc/"+parameters.state+"/"+parameters.deliverable+"/"+parameters.version+"/"+parameters.language+"/"+message.content.imageUrl;
              message.content.imageUrl = url;
              message.content.buttons[0].value = url;
              newMessages.push(message);
            }
          }else{
            // if its no image, nothing is done
            newMessages.push(message);
          }
        })
        messages = newMessages;
        
        // Alexa and google don't allow multiple messages, therefore concatenate all messages to one
        var msg = {type:'text', content:''};
        if(source == 'alexa' || source == 'google'){
          messages.forEach(function(message){
            msg.content += message.content + " ";
          })
          msg.content = msg.content.substring(0, msg.content.length-1);
          messages = [msg];
        }
        
        // send the messages
        if(source == 'alexa' && req){
          alexaApi.sendMessage(messages, memory, false, res).done(function(){
            def.resolve();
          })
        }else if(source =='google' && req){
          googleApi.sendMessage(messages, memory, true, res).done(function(){
            def.resolve();
          })
        }else{
          caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, res).done(function(){
            def.resolve();
          })
        }
      });
    return def.promise();
  }