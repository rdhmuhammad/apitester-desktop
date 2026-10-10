
### ID

```go
ID() string
UUID() string
```

### Product

```go
Product() *ProductInfo
ProductName() string
ProductDescription() string
ProductCategory() string
ProductFeature() string
ProductMaterial() string
ProductUPC() string
ProductAudience() string
ProductDimension() string
ProductUseCase() string
ProductBenefit() string
ProductSuffix() string
ProductISBN(opts *ISBNOptions) string

```

### Person

```go
Person() *PersonInfo
Name() string
NamePrefix() string
NameSuffix() string
FirstName() string
MiddleName() string
LastName() string
Gender() string
Age() int
Ethnicity() string
SSN() string
EIN() string
Hobby() string
SocialMedia() string
Bio() string
Contact() *ContactInfo
Email() string
Phone() string
PhoneFormatted() string
Teams(peopleArray []string, teamsArray []string) map[string][]string
```

### Generate

```go
Struct(v any)
Slice(v any)
Map() map[string]any
Generate(value string) string
Regex(value string) string
```

### Database

```go
SQL(so *SQLOptions) (string, error)
```

### Auth

```go
Username() string
Password(lower bool, upper bool, numeric bool, special bool, space bool, num int) string
```

### Address

```go
Address() *AddressInfo
City() string
Country() string
CountryAbr() string
State() string
StateAbr() string
Street() string
StreetName() string
StreetNumber() string
StreetPrefix() string
StreetSuffix() string
Unit() string
Zip() string
Latitude() float64
LatitudeInRange(min, max float64) (float64, error)
Longitude() float64
LongitudeInRange(min, max float64) (float64, error)
```

### Airline

```go
AirlineAircraftType() string
AirlineAirplane() string
AirlineAirport() string
AirlineAirportIATA() string
AirlineFlightNumber() string
AirlineRecordLocator() string
AirlineSeat() string
```

### Game

```go
Gamertag() string
Dice(numDice uint, sides []uint) []uint
```

### Beer

```go
BeerAlcohol() string
BeerBlg() string
BeerHop() string
BeerIbu() string
BeerMalt() string
BeerName() string
BeerStyle() string
BeerYeast() string
```

### Car

```go
Car() *CarInfo
CarMaker() string
CarModel() string
CarType() string
CarFuelType() string
CarTransmissionType() string
```

### Words

```go
// Nouns
Noun() string
NounCommon() string
NounConcrete() string
NounAbstract() string
NounCollectivePeople() string
NounCollectiveAnimal() string
NounCollectiveThing() string
NounCountable() string
NounUncountable() string
NounProper() string
NounDeterminer() string

// Verbs
Verb() string
VerbAction() string
VerbLinking() string
VerbHelping() string
VerbTransitive() string
VerbIntransitive() string

// Adverbs
Adverb() string
AdverbManner() string
AdverbDegree() string
AdverbPlace() string
AdverbTimeDefinite() string
AdverbTimeIndefinite() string
AdverbFrequencyDefinite() string
AdverbFrequencyIndefinite() string

// Propositions
Preposition() string
PrepositionSimple() string
PrepositionDouble() string
PrepositionCompound() string

// Adjectives
Adjective() string
AdjectiveDescriptive() string
AdjectiveQuantitative() string
AdjectiveProper() string
AdjectiveDemonstrative() string
AdjectivePossessive() string
AdjectiveInterrogative() string
AdjectiveIndefinite() string

// Pronouns
Pronoun() string
PronounPersonal() string
PronounObject() string
PronounPossessive() string
PronounReflective() string
PronounDemonstrative() string
PronounInterrogative() string
PronounRelative() string
PronounIndefinite() string

// Connectives
Connective() string
ConnectiveTime() string
ConnectiveComparative() string
ConnectiveComplaint() string
ConnectiveListing() string
ConnectiveCasual() string
ConnectiveExamplify() string

// Words
Word() string
Interjection() string

// Text
Sentence() string
Paragraph() string
LoremIpsumWord() string
LoremIpsumSentence(wordCount int) string
LoremIpsumParagraph(paragraphCount int, sentenceCount int, wordCount int, separator string) string
Question() string
Quote() string
Phrase() string
PhraseNoun() string
PhraseVerb() string
PhraseAdverb() string
PhrasePreposition() string
Comment() string
```

### Foods

```go
Fruit() string
Vegetable() string
Breakfast() string
Lunch() string
Dinner() string
Snack() string
Dessert() string
Drink() string
```

### Misc

```go
Bool() bool
Weighted(options []any, weights []float32) (any, error)
FlipACoin() string
RandomMapKey(mapI any) any
ShuffleAnySlice(v any)
```

### Colors

```go
Color() string
HexColor() string
RGBColor() []int
HSLColor() []int
SafeColor() string
NiceColors() string
```

### Images

```go
Image(width int, height int) *img.RGBA
ImageJpeg(width int, height int) []byte
ImagePng(width int, height int) []byte
```

### Internet

```go
URL() string
UrlSlug(words int) string
DomainName() string
DomainSuffix() string
IPv4Address() string
IPv6Address() string
MacAddress() string
HTTPStatusCode() string
HTTPStatusCodeSimple() int
LogLevel(logType string) string
HTTPMethod() string
HTTPVersion() string
UserAgent() string
ChromeUserAgent() string
FirefoxUserAgent() string
OperaUserAgent() string
SafariUserAgent() string
APIUserAgent() string
```

### HTML

```go
InputName() string
Svg(options *SVGOptions) string
```

### Date/Time

```go
Date() time.Time
PastDate() time.Time
FutureDate() time.Time
DateRange(start, end time.Time) time.Time
NanoSecond() int
Second() int
Minute() int
Hour() int
Month() int
MonthString() string
Day() int
WeekDay() string
Year() int
TimeZone() string
TimeZoneAbv() string
TimeZoneFull() string
TimeZoneOffset() float32
TimeZoneRegion() string
```

### Payment

```go
Price(min, max float64) float64
CreditCard() *CreditCardInfo
CreditCardCvv() string
CreditCardExp() string
CreditCardNumber(*CreditCardOptions) string
CreditCardType() string
Currency() *CurrencyInfo
CurrencyLong() string
CurrencyShort() string
AchRouting() string
AchAccount() string
BitcoinAddress() string
BitcoinPrivateKey() string
BankName() string
BankType() string
```

### Finance

```go
Cusip() string
Isin() string
```

### Company

```go
BS() string
Blurb() string
BuzzWord() string
Company() string
CompanySuffix() string
Job() *JobInfo
JobDescriptor() string
JobLevel() string
JobTitle() string
Slogan() string
```

### Hacker

```go
HackerAbbreviation() string
HackerAdjective() string
HackeringVerb() string
HackerNoun() string
HackerPhrase() string
HackerVerb() string
```

### Hipster

```go
HipsterWord() string
HipsterSentence() string
HipsterParagraph() string
```

### App

```go
AppName() string
AppVersion() string
AppAuthor() string
```

### Animal

```go
PetName() string
Animal() string
AnimalType() string
FarmAnimal() string
Cat() string
Dog() string
Bird() string
```

### Emoji

```go
Emoji() string
EmojiCategory() string
EmojiAlias() string
EmojiTag() string
EmojiFlag() string
EmojiAnimal() string
EmojiFood() string
EmojiPlant() string
EmojiMusic() string
EmojiVehicle() string
EmojiSport() string
EmojiFace() string
EmojiHand() string
EmojiClothing() string
EmojiLandmark() string
EmojiElectronics() string
EmojiGame() string
EmojiTools() string
EmojiWeather() string
EmojiJob() string
EmojiPerson() string
EmojiGesture() string
EmojiCostume() string
EmojiSentence() string
```

### Language

```go
Language() string
LanguageAbbreviation() string
LanguageBCP() string
ProgrammingLanguage() string
```

### Number

```go
Number(min int, max int) int
Int() int
IntN(n int) int
Int8() int8
Int16() int16
Int32() int32
Int64() int64
IntRange(min, max int) int
Uint() uint
UintN(n uint) uint
Uint8() uint8
Uint16() uint16
Uint32() uint32
Uint64() uint64
UintRange(min, max uint) uint
Float32() float32
Float32Range(min, max float32) float32
Float64() float64
Float64Range(min, max float64) float64
ShuffleInts(a []int)
RandomInt(i []int) int
RandomUint(u []uint) uint
HexUint(bitsize int) string
```

### String

```go
Digit() string
DigitN(n uint) string
Letter() string
LetterN(n uint) string
Vowel() string
Lexify(str string) string
Numerify(str string) string
ShuffleStrings(a []string)
RandomString(a []string) string
```

### Celebrity

```go
CelebrityActor() string
CelebrityBusiness() string
CelebritySport() string
```

### Minecraft

```go
MinecraftOre() string
MinecraftWood() string
MinecraftArmorTier() string
MinecraftArmorPart() string
MinecraftWeapon() string
MinecraftTool() string
MinecraftDye() string
MinecraftFood() string
MinecraftAnimal() string
MinecraftVillagerJob() string
MinecraftVillagerStation() string
MinecraftVillagerLevel() string
MinecraftMobPassive() string
MinecraftMobNeutral() string
MinecraftMobHostile() string
MinecraftMobBoss() string
MinecraftBiome() string
MinecraftWeather() string
```

### Book

```go
Book() *BookInfo
BookTitle() string
BookAuthor() string
BookGenre() string
```

### Movie

```go
Movie() *MovieInfo
MovieName() string
MovieGenre() string
```

### Error

```go
Error() error
ErrorObject() error
ErrorDatabase() error
ErrorGRPC() error
ErrorHTTP() error
ErrorHTTPClient() error
ErrorHTTPServer() error
ErrorRuntime() error
ErrorValidation() error
```

### School

```go
School() string
```

### Song

```go
Song() *SongInfo
SongName() string
SongArtist() string
SongGenre() string
```