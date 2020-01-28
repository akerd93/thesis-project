
mockdata_search = require('../mockdata/search-mockdata.json');
mockdata_content = require('../mockdata/content-mockdata.json');

/*exports.call=function(server, apiPath, parameters){
    var def = deferred();
  
    var url = server + apiPath;
   
    var isFirst = true;
    for(var key in parameters){
      if(isFirst){
        url += "?";
        isFirst=false;
      }else{
        url += "&";
      }
      url += key + "=" + parameters[key];
    }
  
    request.get(url,function(err,res, body){
      if(err){ 
        def.resolve(false);
      }
      if(res.statusCode !== 200 ){ 
        def.resolve(false);
      }
      var data = res.body.data;
      var result;
      if(data && data.content){
        result = data.content;
      }else if(data && data.results && data.results.length>0){
        result = data.results;
      }else if(data && data.products){
        result = data.products;
      }else{
        result = data;
      }
      def.resolve(result);
    });
  
    return def.promise();
  }*/

  // returns search products mockdata
exports.callSearch = function(parameters){
  var def = deferred();
  
  def.resolve(mockdata_search.products);

  return def.promise();
}

// returns search mockdata for sqlfunctions and workflows
exports.callElasticSearch = function(parameters){
  var def = deferred();
  if(parameters.deliverable=='sqlfunctions'){
    def.resolve(mockdata_search.sqlfunctions);
  }else if(parameters.deliverable=='workflows'){
    def.resolve(mockdata_search.workflows);
  }
  return def.promise();
}

// returns mock content for sqlfunctions and workflows
exports.callGetContent = function(parameters){
  var def = deferred();

  if(parameters.deliverable=='sqlfunctions'){
    def.resolve(mockdata_content.sqlfunctions[parameters.topic]);
  }else if(parameters.deliverable=='workflows'){
    def.resolve(mockdata_content.workflows[parameters.topic]);
  }

  return def.promise();
}