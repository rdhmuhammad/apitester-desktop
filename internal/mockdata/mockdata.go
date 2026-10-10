package mockdata

import (
	"strings"

	"github.com/brianvoe/gofakeit/v6"
)

var AvailableMocks = []string{
	"mock.uuid",
	"mock.firstName",
	"mock.lastName",
	"mock.name",
	"mock.email",
	"mock.phone",
	"mock.address",
	"mock.city",
	"mock.country",
	"mock.zip",
	"mock.company",
	"mock.jobTitle",
	"mock.date",
	"mock.color",
	"mock.url",
	"mock.domainName",
	"mock.ipv4Address",
	"mock.username",
	"mock.password",
	"mock.boolean",
	"mock.number",
}

func GenerateMockData(key string) any {
	key = strings.TrimPrefix(key, "mock.")
	switch key {
	case "uuid":
		return gofakeit.UUID()
	case "firstName":
		return gofakeit.FirstName()
	case "lastName":
		return gofakeit.LastName()
	case "name":
		return gofakeit.Name()
	case "email":
		return gofakeit.Email()
	case "phone":
		return gofakeit.Phone()
	case "address":
		return gofakeit.Address().Address
	case "city":
		return gofakeit.City()
	case "country":
		return gofakeit.Country()
	case "zip":
		return gofakeit.Zip()
	case "company":
		return gofakeit.Company()
	case "jobTitle":
		return gofakeit.JobTitle()
	case "date":
		return gofakeit.Date().Format("2006-01-02")
	case "color":
		return gofakeit.Color()
	case "url":
		return gofakeit.URL()
	case "domainName":
		return gofakeit.DomainName()
	case "ipv4Address":
		return gofakeit.IPv4Address()
	case "username":
		return gofakeit.Username()
	case "password":
		return gofakeit.Password(true, true, true, true, false, 12)
	case "boolean":
		return gofakeit.Bool()
	case "number":
		return gofakeit.Number(1, 1000)
	}
	return ""
}
