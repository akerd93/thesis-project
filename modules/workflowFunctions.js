var parameters = {
  deliverable:"workflows"
};

// search function of workflows
exports.search = function(res, conversationToken, taskSummary, voiceRes, source, req){
  var def = deferred();
  
  var objective;
  // depending on input device, detect the workflow entity value
  if(res.nlp){
    objective = res.nlp.entities.workflow[0].raw;
  }else if(source == 'alexa' && req){
    objective = req.body.request.intent.slots.Workflows.value;
  }else if(source == 'google' && req){
    objective = req.body.queryResult.parameters.Workflow;
  }

    var params=parameters;
    params.q = objective;

    var orderedResults = [];
    // start a search for the objective
    contentApi.callElasticSearch(params).done(function(result){
      if(result && result.length>0){
        var memoryKeys = [];
        var memoryValues = [];
  
        var resultList = {};
        resultList.type = 'list';
        resultList.content = {};
        resultList.content.elements = [];
  
        // write results in a list
        var resultJson = {};
        result.forEach(function (x){
          var curListElement = {};
          curListElement.buttons = [{ title:"More", type:"postback", value:x.title }];
          curListElement.subtitle = x.description;
          curListElement.title = x.title;
          curListElement.imageUrl = "";
          resultList.content.elements.push(curListElement);
  
          var id = x.url.split('/')[x.url.split('/').length-1];
          orderedResults.push(x.title);
  
          resultJson[x.title] = x;
        });
  
        // create memory parameters
        memoryKeys.push("workflowResults");
        memoryValues.push(resultJson);
  
        memoryKeys.push("awaitInput");
        memoryValues.push("workflowChoice");
  
        memoryKeys.push("searchObjective");
        memoryValues.push(objective);

        memoryKeys.push("orderedResults");
        memoryValues.push(orderedResults);
  
        // implement two different versions of the message depending on input device
        var messages = [];
        if(source == 'webchat'){
          messages.push({type:"text",content:"Please choose a result:"});
          messages.push(resultList);
        }else if(source =='alexa' || source == 'google'){
          var content = "I have found '" + orderedResults[0] + "'. Is that what you were looking for?"
          messages.push({type:"text", content:content})
        }
  
        // for Alexa, build memory in the required format
      if(source == 'alexa' && req){
        var memory = {};
        for(var i = 0; i < memoryKeys.length; i++){
          memory[memoryKeys[i]] = memoryValues[i];
        }
        // send messages to alexa input device
        alexaApi.sendMessage(messages, memory, false, voiceRes).done(function(req, res){
          def.resolve();
        });
      // build memory in the required format for google
      }else if(source == 'google' && req){
        var memory = {};
        for(var i = 0; i < memoryKeys.length; i++){
          memory[memoryKeys[i]] = memoryValues[i];
        }
        // send messages to google input device
        googleApi.sendMessage(messages, memory, true, voiceRes).done(function(req, res){
          def.resolve();
        });
      }else{
        // set memory in CAI and send messages
        caiApi.updateMemory(memoryKeys,memoryValues,conversationToken).done(function(req,res){
            caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, voiceRes).done(function(req, res){
              def.resolve();
            });
          });
        }
      }
    });
  
    return def.promise();
}

// selecting a workflow
exports.select = function(res, conversationToken, taskSummary, voiceRes, source, req){
  var def = deferred();
  
  var choice;
  var memory;
  var intent = "";

  // if input device was webchat
  if(res.nlp){
    choice = res.nlp.source;
    memory = res.conversation.memory;
    // find intent
    if(res.nlp.intents[0] && res.nlp.intents[0].slug){
      intent = res.nlp.intents[0].slug;
    }
  }
  // if input device was alexa
  if(source == 'alexa'){
    // if req exists then this is variant 1 of alexa
    if(req){
      // find intent and memory
      intent = req.body.request.intent.name;
      memory = req.body.session.attributes;

      var endSession = false;

      // if user selected yes, then the provided workflow was the correct one
      if(intent == 'AMAZON.YesIntent'){
        choice = memory.orderedResults[0];
        // if he selected no, then the second result is tried instead and first one is discarded
      }else if(intent == 'AMAZON.NoIntent'){
        var newOrderedResults = [];
        for(i = 1; i < memory.orderedResults.length; i++){
          newOrderedResults.push(memory.orderedResults[i]);
        }
        
        var messages = [{type:'text',content:"Were you looking for '" + newOrderedResults[0]  + "' instead?"}];
        if(!newOrderedResults[0]){
          messages = [{type:'text', content:'There are no other results. Please try again.'}];
          endSession = true;
        }
        memory.orderedResults = newOrderedResults;
        alexaApi.sendMessage(messages, memory, endSession, voiceRes).done(function(){
          def.resolve();
        })
    }else{
      // this is variant 2 of alexa
      if(intent == 'yes'){
        choice = memory.orderedResults[0];
      }else if(intent == 'no'){
        var newOrderedResults = [];
        for(i = 1; i < memory.orderedResults.length; i++){
          newOrderedResults.push(memory.orderedResults[i]);
        }
        var messages = [{type:'text',content:"Were you looking for '" + newOrderedResults[0]  + "' instead?"}];
        caiApi.updateMemory('orderedResults', newOrderedResults, conversationToken).done(function(){
          caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, voiceRes).done(function(){
            def.resolve();
          })
        })
      }
    }
    
  }
}

// if input device was google
if(source == 'google'){
  // if req exists, its variant 1
  if(req){
    var intent = req.body.queryResult.intent.displayName;
    var memory;
    // outputContexts are googles memory
    // read the memory
    var outputContexts = req.body.queryResult.outputContexts;
    for(var i =0; i<outputContexts.length; i++){
      if(outputContexts[i].parameters && outputContexts[i].parameters.data && outputContexts[i].parameters.data.workflowResults){
        memory = outputContexts[i].parameters.data;
        break;
      }
    }
    var continueSession = true;

    // if user selected yes, then first result was selected
    if(intent == 'searchWorkflow - yes'){
      choice = memory.orderedResults[0];
    // if user selected no, then second result will be tried and first will be discarded
    }else if(intent == 'searchWorkflow - no'){
      var newOrderedResults = [];
      for(i = 1; i < memory.orderedResults.length; i++){
        newOrderedResults.push(memory.orderedResults[i]);
      }
      
      var messages = [{type:'text',content:"Were you looking for '" + newOrderedResults[0]  + "' instead?"}];
      if(!newOrderedResults[0]){
        messages = [{type:'text', content:'There are no other results. Please try again.'}];
        continueSession = false;
      }
      memory.orderedResults = newOrderedResults;
      googleApi.sendMessage(messages, memory, continueSession, voiceRes).done(function(){
        def.resolve();
      })
  // if req is null then its variant 2
  }else{
    // same as above
    if(intent == 'yes'){
      choice = memory.orderedResults[0];
    }else if(intent == 'no'){
      var newOrderedResults = [];
      for(i = 1; i < memory.orderedResults.length; i++){
        newOrderedResults.push(memory.orderedResults[i]);
      }
      var messages = [{type:'text',content:"Were you looking for '" + newOrderedResults[0]  + "' instead?"}];
      caiApi.updateMemory('orderedResults', newOrderedResults, conversationToken).done(function(){
        caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, voiceRes).done(function(){
          def.resolve();
        })
      })
    }
  }
  }
  }

  // once a user selected yes, if the selected workflow is within the results
  if(memory.workflowResults[choice] && intent != "no"){
    var workflow = memory.workflowResults[choice];
    var topic = workflow.loio;
    var workflowName = workflow.title;

    var params = parameters;
    params.topic = topic;
    // send a request for content of the topic
    contentApi.callGetContent(params).done(function(result){
      var chapterObj = sharedFunctions.readChapters(result, workflowName, workflow.url);
      
      var messages = [];

      // build different messages for the inputp devices
      if(source=='alexa' || source == 'google'){
        var msg = {};
        msg.type = 'text';
        msg.content = 'Which of the following chapters do you want first? ';
        chapterObj.chapters.forEach(function(chapter){
          msg.content += chapter + ", ";
        });
        msg.content = msg.content.substring(0, msg.content.length-2);
        messages.push(msg);
      }else{
        //messages.push({"type":"text", "content":"What do you want to know about "+workflowName+"?"});
        messages.push({'content':'Choose a chapter:', 'type':'text'});
        messages.push(chapterObj.msg);
      }

      // send a response to voice devices
      if(req){
        var memory = {};
        memory.workflowName = workflowName;
        memory.awaitInput = 'workflowChapter';
        memory.workflow = workflow;
        memory.chapters = chapterObj.chapters;
        if(source == 'alexa'){
          alexaApi.sendMessage(messages, memory, false, voiceRes).done(function(){
            def.resolve();
          })
        }else if(source =='google'){
          googleApi.sendMessage(messages, memory, true, voiceRes).done(function(){
            def.resolve();
          })
        }
      // send a response to webchat
      }else{
        caiApi.updateMemory(["workflowName","awaitInput", "workflow", "chapters"],[workflowName,"workflowChapter",workflow, chapterObj.chapters], conversationToken).done(function(){
          caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, voiceRes).done(function(){
            def.resolve();
          });
        });
      }
    
    });
  }


  return def.promise();
}

// once a chapter was selected
exports.select_chapter = function(res, conversationToken, taskSummary, voiceRes, source, req){
  var def = deferred();

  var memory;
  var chapter;
  
  // read the selected chapter based on input device
  if(res.nlp){
    memory = res.conversation.memory;
    chapter = res.nlp.source;
  }else if(source == 'alexa' && req){
    memory = req.body.session.attributes;
    chapter = req.body.request.intent.slots.chapters.value;
  }else if(source == 'google' && req){
    var outputContexts = req.body.queryResult.outputContexts;
    for(var i =0; i<outputContexts.length; i++){
      if(outputContexts[i].parameters && outputContexts[i].parameters.data){
        memory = outputContexts[i].parameters.data;
        break;
      }
    }
    chapter = req.body.queryResult.queryText;
  }
  
  var topic = memory.workflow.loio;
  var workflow = memory.workflow;

  var params = parameters;
  params.topic = topic;

  //var memory = res.conversation.memory;
  var workflow = memory.workflow;

  var topic = workflow.loio;

  // send another content request
  contentApi.callGetContent(params).done(function(result){
    var html = $(result.content);
    // extract the chapter
    var parserResult = sharedFunctions.parseHtml(html, chapterFound, chapter, "workflows");
    var chapterFound = parserResult.chapterFound;
    var messages = parserResult.messages;
    // if no chapter was found, inform the user
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
                "value": "https://help.sap.com"+workflow.url
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
          var url = "https://help.sap.com/doc/"+parameters.state+"/"+parameters.deliverable+"/"+parameters.version+"/"+parameters.language+"/"+message.content.imageUrl;
          message.content.imageUrl = url;
          message.content.buttons[0].value = url;
          newMessages.push(message);
        }
      }else{
        newMessages.push(message);
      }
    })
    messages = newMessages;

    // concatenate messages for alexa and google because they don't allow multiple
    var msg = {type:'text', content:''};
    if(source == 'alexa' || source == 'google'){
      messages.forEach(function(message){
        msg.content += message.content + " ";
      })
      msg.content = msg.content.substring(0, msg.content.length-1);
      messages = [msg];
    }
    
    // based on input device, send messages
    if(source == 'alexa' && req){
      alexaApi.sendMessage(messages, memory, false, voiceRes).done(function(){
        def.resolve();
      })
    }else if(source =='google' && req){
      googleApi.sendMessage(messages, memory, true, voiceRes).done(function(){
        def.resolve();
      })
    }else{
      caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, voiceRes).done(function(){
        def.resolve();
      })
    }
  });

  return def.promise();
}