## Serverless REST Assignment - Distributed Systems.



__Name:__ Dylan Butler Parry (20099082)



__Demo:__ ... link to your YouTube video demonstration ......



### Context.



The context for my API is a retro games - a collection of games available for each retro platform.

The primary database table contains retro game objects with the following attributes
- id (number)
- title (string) (Sort Key)
- genre (string[])
- platform (string) (Partition Key)
- release_date (string)
- developer (string)
- publisher (string)
- description (string)
- cover_art_path (string)
- screenshots (string[])
- rating (number)
- popularity (number)
- multiplayer (boolean)
- average_score (number)
- review_count (number)



### App API endpoints.



+ GET /retroGames - Retrieves all retro games from the table.

+ GET /retroGames?title={title}&language={languageCode} - Get a specific retro game from a platform, based on it's title.

+ POST /retroGames - Add a new retro game to the table. Platform and title are retrieved from the POST body.

+ PUT /retroGames - Update a retro game currently in the table. Platform and title are retrieved from the POST body.



### Update constraint


Authentication is required to access the POST and PUT endpoints - meaning only a user who is authenticated, and has a valid JWT is permitted to add/update the table.
When a new game is added to the database, the userId is gotten from the event.requestContext.authorizer - this userId is then added to the retro game entry in the table. Since we now
know the userId of the user who added the game, we can perform checks when updating to determine if the userId matches.

The userId will persist between sessions, since we are signing into the same account. The JWT contains the userId in it's payload, in the sub parameter.

When a user attempts to update a game in the database, the userId is retreieved from the supplied JWT; This has been done to highlight two examples of how to access the userId. If the 
userId matches, allow the user to perform the update. If the userId doesn't match, that means that the user has supplied a valid JWT, but not with the same userId as the user who added the item to the table.



### Translation persistence



Persistence was achieved through the creation of a second table translated_table, with partition key of ID and sort key of language. When the user requests an item from the retro games table, with language={langCode} in the query string the lambda function will check to see does an item with the same ID and language already exist in the table. If the item exists, it will return the object found in the translated table.

If the item doesn't already exist, it will immediately send the object returned from the initial get query to a helper function, translateJsonCollection(). This function will iterate through each of the attributes, and then add the translated attributes to a new json collection. It will then return once every attribute (where applicable) has been translated. This translated return object then gets added to the translated_table, meaning if a user was to send the above query again, they would be hitting the translated_table instead of translating the object again.

This was verified through the use of HTTP headers - a custom header "cache-hit" was added, and will return true if the translated_table was used to get the translate response, or false if the object was required to be translated before being returned.



###  Extra



A Postman collection is available at the following url [Postman Collection - REST API v1](https://1drv.ms/u/s!AifmLuBQfqioje5VtFJerQCwYhdXnA?e=x3fJbu)



### Steps to run


+ Git clone repository
+ npm install
+ cdk deploy
+ Take AppAPI URL and put into Postman URL variable, AppAuthAPI URL into AuthURL variable
+ Signup --> Confirm signup --> Signin
+ Take token from signin, and put into Postman variable

