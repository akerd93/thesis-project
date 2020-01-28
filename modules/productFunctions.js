

// product search
exports.search = function(res, conversationToken, taskSummary, alexaRes, source){
  var def = deferred();

  // take the objective
  var objective = res.nlp.source;
  var params = {};
  params.q = objective;

  // request a search using the objective
  contentApi.callSearch(params).done(function(result){
    // if results were found
    if(result && result.length>0){
      // create a list of results
      var resultList = {};
      resultList.type = 'list';
      resultList.content = {};
      resultList.content.elements = [];

      // add links for each result
      result.forEach(function (x){
        var curListElement = {};
        var url = "https://help.sap.com" + x.url;
        curListElement.buttons = [{ title:"Open", type:"web_url", value:url }];
        curListElement.subtitle = "";
        curListElement.title = x.title;
        curListElement.imageUrl = "";
        resultList.content.elements.push(curListElement);
      });

      // add a "here are your results" message
      var messages = [];
      messages.push({type:"text",content:"Here are your results:"});
      messages.push(resultList);
    


      //messages.push(resultCarousel);

      //sendMessage(resultCarousel.content, resultCarousel.type, conversationToken, taskSummary);

      // delete unwanted memory keys and send the message
      caiApi.deleteMemoryKey("awaitInput", conversationToken).done(function(req,res){
        caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(req, res){
          def.resolve();
        });
      });
    }else{
      // if no results were found, let the user know
      var messages = [{type:"text", content:"Sorry, I could not find a result."}];
      caiApi.deleteMemoryKey("awaitInput", conversationToken).done(function(req,res){
        caiApi.sendMessageArray(messages, conversationToken, taskSummary, source, alexaRes).done(function(req, res){
          def.resolve();
        });
      })
    }
  });

  return def.promise();
}