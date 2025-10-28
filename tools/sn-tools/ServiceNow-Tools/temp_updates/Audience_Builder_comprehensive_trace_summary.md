# Audience Builder Comprehensive Component Data Flow Summary

## Component Architecture Overview

**Main Component**: Audience Builder  
**Location**: `W:\Tenon\Tenon Repo\component-library\AudienceBuilder\src\cadso-audience-builder\`  
**Sashimono Dependencies**: 5  
**Total REST APIs**: 3 (main component only)  

## Sashimono Component Dependencies

### 1. ConditionBuilder
- **Path**: `W:\Tenon\Tenon Repo\Sashimono\ConditionBuilder`
- **Usage**: imported (as both `condition-builder` and `ConditionBuilder`)
- **Purpose**: Filter condition building UI component
- **REST APIs**: *To be determined - requires network connection*

### 2. Button  
- **Path**: `W:\Tenon\Tenon Repo\Sashimono\Button`
- **Usage**: imported as `button`
- **Purpose**: Basic button UI component
- **REST APIs**: *To be determined - requires network connection*

### 3. Loader
- **Path**: `W:\Tenon\Tenon Repo\Sashimono\Loader`
- **Usage**: imported as `loader` 
- **Purpose**: Loading spinner/progress indicator
- **REST APIs**: *To be determined - requires network connection*

### 4. Input
- **Path**: `W:\Tenon\Tenon Repo\Sashimono\Input`
- **Usage**: imported as `input`
- **Purpose**: Form input field component
- **REST APIs**: *To be determined - requires network connection*

## Main Component REST APIs (3)

### 1. Audience Builder - Fetch
- **URI**: `/api/x_cadso_automate/ui/audienceBuilder/fetch`
- **Method**: POST
- **sys_id**: 05afff0087ab0a10369f33373cbb3586
- **Purpose**: Fetches audience configuration data
- **Script Includes**: Direct GlideRecord usage (no Script Includes called)
- **MS Pattern**: No
- **Key Tables**: 
  - `x_cadso_automate_audience` (main audience table)
  - `x_cadso_automate_audience_hash` (static member storage)

### 2. Audience Builder - Count  
- **URI**: `/api/x_cadso_automate/ui/audienceBuilder/count`
- **Method**: POST
- **sys_id**: 910ff46d87cf4210369f33373cbb35ca
- **Purpose**: Counts records based on audience criteria
- **Script Includes**: `x_cadso_automate.APIUtils` + `APIUtilsMS` (MS pattern)
- **MS Pattern**: Yes
- **Key Tables**: Dynamic based on audience configuration

### 3. Audience Builder - Save
- **URI**: `/api/x_cadso_automate/ui/audienceBuilder/save`
- **Method**: POST  
- **sys_id**: d844282fc39b461085b196c4e40131de
- **Purpose**: Saves audience filters and configuration
- **Script Includes**: `x_cadso_automate.Audience` + `AudienceMS` (MS pattern)
- **MS Pattern**: Yes
- **Key Tables**: 
  - `x_cadso_automate_audience` (main audience table)
  - `x_cadso_automate_audience_hash` (static member storage)

## Frontend Component Integration Points

### Action Handlers
- **Location**: `W:\Tenon\Tenon Repo\component-library\AudienceBuilder\src\cadso-audience-builder\configurations\actionHandlers\`

#### Save Flow (saveHandlers.js)
```javascript
TENON_LIST_BUILDER_SAVE_FILTERS → 
TENON_LIST_BUILDER_SAVE → 
/api/x_cadso_automate/ui/audienceBuilder/save →
x_cadso_automate.Audience + AudienceMS →
TENON_LIST_BUILDER_SAVE_SUCCESS
```

#### Fetch Flow (fetchRecordHandlers.js)  
```javascript
TENON_LIST_BUILDER_FETCH_RECORD →
/api/x_cadso_automate/ui/audienceBuilder/fetch →
Direct GlideRecord operations →
TENON_LIST_BUILDER_FETCH_RECORD_SUCCESS
```

#### Count Flow (fetchCountHandlers.js)
```javascript
TENON_LIST_BUILDER_FETCH_COUNT_INIT →
TENON_LIST_BUILDER_FETCH_COUNT →
/api/x_cadso_automate/ui/audienceBuilder/count →
x_cadso_automate.APIUtils + APIUtilsMS →
TENON_LIST_BUILDER_FETCH_COUNT_SUCCESS
```

## Script Include Analysis

### Primary Script Includes
1. **x_cadso_automate.Audience + AudienceMS**
   - **Used by**: Audience Builder - Save
   - **Purpose**: Audience management operations
   - **MS Pattern**: ✅ Yes (AudienceMS companion)

2. **x_cadso_automate.APIUtils + APIUtilsMS**  
   - **Used by**: Audience Builder - Count
   - **Purpose**: Count operations and general API utilities
   - **MS Pattern**: ✅ Yes (APIUtilsMS companion)

### MS Pattern Compliance
- **Total APIs**: 3
- **Using MS Pattern**: 2/3
- **Pattern Compliance**: 66.7%
- **Note**: Fetch operation uses direct GlideRecord instead of Script Includes

## Database Schema

### Primary Tables
1. **x_cadso_automate_audience**
   - **Purpose**: Main audience configuration storage
   - **Key Fields**: source, conditions, type, count, view, order_by, table, filter_object

2. **x_cadso_automate_audience_hash**
   - **Purpose**: Static audience member storage  
   - **Key Fields**: audience (reference), member_hash (JSON array)

### Audience Types
- **Dynamic**: Uses encoded queries to filter records in real-time
- **Static**: Uses pre-calculated member hashes stored in audience_hash table

## Component Data Flow Map

```
Audience Builder (Main Component)
├── Frontend (ServiceNow UI Framework)
│   ├── Action Handlers (save, fetch, count)
│   ├── State Management (updateState, dispatch)  
│   └── Error Handling (TENON_ERROR)
├── Sashimono Dependencies:
│   ├── ConditionBuilder (filter UI)
│   ├── Button (UI controls)  
│   ├── Loader (loading states)
│   └── Input (form fields)
├── REST APIs (3 total)
│   ├── /audienceBuilder/fetch (Direct GlideRecord)
│   ├── /audienceBuilder/count (APIUtils + APIUtilsMS)
│   └── /audienceBuilder/save (Audience + AudienceMS)
├── Script Includes (2 unique + MS companions)
│   ├── x_cadso_automate.Audience + AudienceMS
│   └── x_cadso_automate.APIUtils + APIUtilsMS
└── Database Tables
    ├── x_cadso_automate_audience (config)
    └── x_cadso_automate_audience_hash (static members)
```

## Architecture Insights

### Strengths
- **Clear separation** of concerns between dynamic and static audiences
- **MS pattern adoption** for 66.7% of operations
- **Comprehensive Sashimono integration** for reusable UI components
- **Robust error handling** with centralized error management

### Areas for Improvement
- **Fetch operation** could benefit from Script Include abstraction instead of direct GlideRecord
- **Network connectivity issues** prevent full Sashimono API tracing
- **Consider standardizing** all operations to use MS pattern for consistency

### Security Considerations
- **ACL enforcement** enabled on all REST operations
- **Tenon Automate UI API Access** ACL controls access
- **Data validation** should be verified in Script Includes

## Generated Files
- **Detailed API Operations**: `temp_updates/*_complete.json`
- **Component Source**: `component-library/AudienceBuilder/`
- **Sashimono Dependencies**: 5 components in `Sashimono/` directory

---
*Generated by ServiceNow Comprehensive Component Tracer*  
*Trace Date: 2025-01-27*