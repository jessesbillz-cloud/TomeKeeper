"""HTTP routers — thin translation between HTTP and the service layer.

Each router:
- Accepts a per-request user-scoped Supabase client via dependency injection.
- Delegates all DB work to the matching service module.
- Translates service exceptions (NotFoundError) into HTTP 404.
"""
