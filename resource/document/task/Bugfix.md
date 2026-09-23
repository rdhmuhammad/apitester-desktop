
### Bug
- ~~Bug while manage configuration variable~~
	- ~~when i edit value, all item value and key following the current item~~
	- ~~after editing got error collection id not found~~
- ~~Bug at tree collection~~
	- ~~When toggle folder, all item following it~~
	- ~~Searching item also have bug, item tree duplicate it self~~ 
	- Bug at send request
- ~~changing base url not affecting the request sent, always use default base url~~
- Tree content disapear after multiple changing
- ~~when update, and create new collection first verify the content is valid. if not then return error content not valid~~

### New Feature
- Fix the old version checksum
- if checksum is fixed, then when listen the current collection file. if any change from outside this app, notify the app to refresh it self
- Add refresh button at windows bar for manually refresh it
- Create log file for frontend network, and console log

### New Feature (Web version)
- backend service should be intact with target service, mimicking swagger
- Work around Spring service 
	- I can use the current repo for apitester-generator-spring
	- Create jar library that can be enable via annotation configuration to target service
	- the react build is live within the jar library
- Work around Go service
	- turn the current repository as go library
	- after setup, copy the react build to target service public folder
- Remove select collection
### Refactor
- Compact all socket to one entry point
- ~~Check id assigment for variable collection at backend~~
- ~~folder dont have id~~ 
