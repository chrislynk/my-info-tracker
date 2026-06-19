**My Info Tracker**

My Info Tracker is a personal knowledge and life-management platform built with React and AWS Amplify.

The application combines elements of a personal knowledge base, project tracker, journal, task manager, and record system into a single flexible data model. Rather than maintaining separate applications for notes, projects, trackers, and journals, all information is stored as structured records that can be organized, searched, filtered, and connected.

The project is designed as a personal “second brain” that helps capture information, track progress, record events, and preserve knowledge over time.

**Core Concepts**

Everything in the system is a Record.

Records can represent:

*   Projects
    
*   Tasks (ToDo)
    
*   Diary entries
    
*   Trackers
    
*   Collections
    
*   Lists
    
*   General notes
    

Each record can contain:

*   Title
    
*   Notes
    
*   Start and end dates
    
*   Status
    
*   Tags
    
*   Template type
    
*   Grouping information
    
*   Optional image attachments
    

**Current Features**

**Record Management**

*   Create records
    
*   Edit records inline
    
*   Delete records
    
*   Search records
    
*   Filter by template type
    
*   Organize by project and grouping
    

**Knowledge Organization**

*   Structured record templates
    
*   Tags and categorization
    
*   Grouped record views
    
*   Project-oriented organization
    

**Media Support**

*   Upload image attachments
    
*   Replace images safely
    
*   Automatic cleanup of orphaned images
    

**Relationship System (In Development)**

Records can be linked together using explicit relationships.

Examples:

*   Project → depends on → Research Note
    
*   Task → references → Project
    
*   Diary Entry → related to → Project
    
*   Tracker → part of → Collection
    

Relationship types currently include:

*   related\_to
    
*   depends\_on
    
*   part\_of
    
*   references
    
*   blocks
    
*   duplicate\_of
    

This provides the foundation for backlinks, knowledge graphs, and richer navigation across records.

**Long-Term Vision**

The goal is to create a flexible personal information platform that supports:

*   Knowledge management
    
*   Project management
    
*   Personal journaling
    
*   Habit and activity tracking
    
*   Information collections
    
*   Linked records and contextual navigation
    

The system is intentionally built around a single extensible data model so new use cases can be supported without creating separate applications.

**Technology Stack**

**Frontend**

*   React
    
*   Vite
    
*   JavaScript
    
*   CSS
    

**Backend**

*   AWS Amplify Gen 2
    
*   AppSync GraphQL API
    
*   DynamoDB
    
*   Amazon S3
    

**Hosting**

*   AWS Amplify Hosting
    

**Data Model**

**Record**

Primary information object.

Key fields:

*   id
    
*   title
    
*   notes
    
*   start
    
*   end
    
*   tags
    
*   template
    
*   status
    
*   grouping
    
*   imageKey
    
*   createdAt
    
*   updatedAt
    

**RecordRelationship**

Links records together.

Fields:

*   id
    
*   sourceRecordId
    
*   targetRecordId
    
*   type
    
*   note
    
*   createdAt
    
*   updatedAt
