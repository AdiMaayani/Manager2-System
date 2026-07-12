namespace ManageR2.Infrastructure.DAL.Providers;

// Runtime switches that drive the phased dual-run. Bound from the "DataProvider"
// configuration section. Defaults keep the system on the SQL Server baseline so an
// unconfigured environment behaves exactly as it did before the migration work.
public sealed class DataProviderOptions
{
    public const string SectionName = "DataProvider";

    // Authoritative provider whose result is returned to callers.
    public DatabaseProvider Primary { get; set; } = DatabaseProvider.SqlServer;

    // When true and the primary is SQL Server, reads are also issued against Postgres
    // and compared for drift. Has no effect on the response returned to the caller.
    public bool ShadowReadPostgres { get; set; }

    // When true and the primary is SQL Server, writes are also applied to Postgres on a
    // best-effort basis. A dual-write failure is recorded but never fails the primary write.
    public bool DualWritePostgres { get; set; }
}
