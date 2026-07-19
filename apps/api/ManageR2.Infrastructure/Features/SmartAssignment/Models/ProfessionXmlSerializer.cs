using System.Xml;
using System.Xml.Linq;
using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Models.SmartAssignment;

/// <summary>
/// SQL Server compatibility-level 100 collection transport. API contracts remain JSON arrays,
/// while stored procedures receive/return a small typed XML document instead of using OPENJSON.
/// </summary>
public static class ProfessionXmlSerializer
{
    public static string Serialize(IEnumerable<string?>? values)
    {
        var roles = ProfessionCollection.Normalize(values);
        return new XElement(
            "Roles",
            roles.Select(role => new XElement("Role", role))).ToString(SaveOptions.DisableFormatting);
    }

    public static List<string> Deserialize(string? xml, string? legacyFallback = null)
    {
        if (string.IsNullOrWhiteSpace(xml))
        {
            return ProfessionCollection.Resolve(null, legacyFallback).ToList();
        }

        try
        {
            var document = XElement.Parse(xml, LoadOptions.None);
            return ProfessionCollection.Normalize(
                document.Elements("Role").Select(element => element.Value)).ToList();
        }
        catch (XmlException)
        {
            return ProfessionCollection.Resolve(null, legacyFallback).ToList();
        }
    }
}
