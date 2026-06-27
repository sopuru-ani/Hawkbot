UMES_SECTIONS = [
    "about",
    "academic",
    "admissions",
    "auxiliary",
    "comptroller",
    "financialaid",
    "henson",
    "hr",
    "ia",
    "it",
    "president",
    "reslife",
]

SECTION_DESCRIPTIONS = """
- about: university overview, history, identity, leadership, institutional information
- academic: majors, minors, degrees, programs, catalogs, courses, colleges, departments
- admissions: applying, enrollment, requirements, visiting campus
- auxiliary: auxiliary and support services
- comptroller: business office, billing, payments
- financialaid: scholarships, grants, FAFSA, financial aid forms and policies
- henson: Henson School and related programs
- hr: human resources, employment, jobs
- ia: institutional advancement, fundraising
- it: information technology, computing services
- president: president's office and communications
- reslife: residence life, housing, dorms, residence halls, on-campus living
""".strip()

VALID_SECTION_SET = frozenset(UMES_SECTIONS)
