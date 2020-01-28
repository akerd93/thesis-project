// Reads html and extracts chapter content - parameter chapter is based on user input
exports.parseHtml = function(html, chapterFound, chapter, contentModule){
  // take each element with class section
  var sections = $('.section', html);
    var messages = [];
    var chapterFound = false;
    // For each of the sections
    sections.each(function(x){
      // collect h2 element within current section
      var title = $('h2', this).html();
      // check if the h2 element is equal to the wanted chapter of the user
      if(title.toLowerCase() == chapter.toLowerCase()){
        chapterFound = true;
        // go through all child elements
        $(this).children().each(function(x){
          // skip element with class tasklabel - it is the header
          if(!$(this).hasClass('tasklabel')){
            // if element is an ordered list
            if($(this).hasClass('ol')){
                // take each step and write it to a message. Add a numerator
                var steps = $('li.step', this);
                var i = 1;
                steps.each(function(y){
                  var msg = { content:"", type:"text"};
                  msg.content = i + ". " + $(this).text().replace( /\s\s+/g, ' ');
                  if(msg.content){
                    messages.push(msg);
                    i++;
                  }
                  /* Currently unusable, because of missing tagging.
                    Would extract images and write them to a card in webchat
                  var images = $('img', this);
                  images.each(function(z){
                    var src = $(this).prop('src');
                    msg = {
                      "type": "card",
                      "content": {
                        "title": "",
                        "subtitle": "",
                        "imageUrl": src,
                        "buttons": [
                          {
                            "title": "Enhance",
                            "type": "web_url",
                            "value": src
                          }
                        ]
                      }
                    }
                    messages.push(msg);
                  })*/
                })
            // If element is not a list
            }else{
                // also make sure its not a section or h2 element
                if(!$(this).is('section') && !$(this).is('h2')){
                  // skip tables
                  if(!$(this).hasClass('table-wrapper')){
                      // take the text content and escape HTML because some topics contain HTML
                      // split messages at full words after 140 characters
                      var splitRes=$(this).text().escapeHtml().replace( /\s\s+/g, ' ').replace(/.{140}\S*\s+/g, "$&@").split(/\s+@/);
                  }else{
                    var splitRes = [];
                  }
                  
                  // create a chatbot message for each result found
                  splitRes.forEach(function(y){
                    var msg = { content:y, type:"text" }
                    if(msg.content){
                      msg.content = msg.content.replace( /\n/g, ' ' );
                      messages.push(msg);
                    }
                  })

                /* legacy code; replace with correct image finding once tagging is done
                if($(this).is('img')){
                    var src = $(this).attr('src');
                    var msg = { type:'picture', content:src }
                    messages.push(msg);
                  }*/
              }
            }
            
          }
        });
        // If no messages were found, text is usually unnested (above only searches child elements)
        if(messages.length==0){
          // take unnested text
          var unnestedText = $(this).clone().children().remove().end().text();
          if(unnestedText.trim() != ""){
            // and write it to a message
            var msg = {content:unnestedText, type:"text"}
            if(msg.content){
              messages.push(msg);
            }
          }
        }
      }        
    })
    // return an obj that states whether the chapter has been found and includes messages
    var obj = {messages:messages, chapterFound:chapterFound};
    return obj;
}

// extract all chapter titles within HTML
exports.readChapters = function(result, objective, url){
    var html = $(result.content);
  
    // select all elements with class section
    var sections = $('.section', html);
  
    var chapter = [];
    // for each of those, select h2 elements
    sections.each(function(section){
      var h2 = $('h2', this);
      // write content of h2 elmeents to chapter array
      chapter.push(h2.html());
    })
    
    var messages = [];
  
    // create a chatbot message
    messages.push({"type":"text", "content":"What do you want to know about "+objective+"?"});
  
    // create a chatbot message of type list
    var msg = {
      "type": "list",
      "content": {
        "elements": []
      }  
    }
  
    // write all chapter names in the list
    var foundChapterTitles = [];
    chapter.forEach(function(x){
      var obj = {
        "title": x,
        "imageUrl": "",
        "subtitle": "",
        "buttons": [
          {
            "title": "Select",
            "type": "postback",
            "value": x
          }
        ]
      }
      if(!foundChapterTitles.includes(x)){
        msg.content.elements.push(obj);
        foundChapterTitles.push(x);
      }
    })
    // add an open link button
    msg.content.elements.push({
      "title": "Open link",
      "imageUrl": "",
      "subtitle": "",
      "buttons": [
        {
          "title": "Select",
          "type": "web_url",
          "value": "https://help.sap.com"+url
        }
      ]
    });
  
    var chapterObj = {
      msg: msg,
      chapters: foundChapterTitles
    }
  
    return chapterObj;
  }


// if fallback was triggered, simply return the fallbackMessage belonging to the fallback skill
 exports.fallback = function(res, conversationToken, taskSummary){
    var skillDef = deferred();
    var fallbackMessage = res.messages[0];
    caiApi.sendMessage(fallbackMessage.content, fallbackMessage.type, conversationToken, taskSummary).done(function(){
      skillDef.resolve();
    });
    return skillDef.promise();
  }

  String.prototype.escapeHtml = function() {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    return this.replace(/[&<>]/g, function(tag) {
        return tagsToReplace[tag] || tag;
    });
};