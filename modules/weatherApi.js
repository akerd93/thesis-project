
// This uses the MetaWeather.com API
exports.getWeather = function(datetime, location){
    var def = deferred();
    var minTemp = 1000;
    var maxTemp = -1000;
    
    // SAP CAI always includes latitude and longitude in location entity. Use that to request a location id
    var url = "https://www.metaweather.com/api/location/search/?lattlong="+location.lat+','+location.lng;
    request.get(url,function(err,res){
      if(res.status && res.status==200){
        if(res.body && res.body.length > 0){
          var result = res.body[0];
          // request a weather forecast for certain location id and date
          var url = "https://www.metaweather.com/api/location/"+result.woeid+"/"+datetime.iso.split('T')[0].replace(/-/g,'/')+"/";
          request.get(url,function(err,res){
            if(res.status && res.status == 200){
              if(res.body && res.body.length > 0){
                res.body.forEach(function(x){
                  // forecast contains a temperature for each few minutes
                  // extract only min and max temperatures for the day
                  if(x.applicable_date == datetime.iso.split('T')[0]){
                    if(x.min_temp < minTemp){
                      minTemp = x.min_temp;
                    }
                    if(x.max_temp > maxTemp){
                      maxTemp = x.max_temp;
                    }
                  }
                })
                var msg = {
                  content:"",
                  type:"text"
                }
                // remove an unnecessary - if the minTemp is 0
                if(minTemp.toString().startsWith('-0')){
                  minTemp = minTemp.toString().substring('1',minTemp.length);
                }
                // build a message for the user containing the weather forecast
                msg.content = "The temperature in " + location.formatted + " on " + datetime.formatted.split(' at ')[0] + " will range from " + minTemp.toString().split(".")[0] + "-" + maxTemp.toString().split(".")[0] + " degrees C";  
                def.resolve(msg.content);
              }
            }
          });
        }else{
          def.resolve("not found");
        }
      }
    });
    return def.promise();
  }