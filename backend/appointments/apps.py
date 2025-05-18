# apps.py
from django.apps import AppConfig

class AppointmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'appointments'

    def ready(self):
        # Import here to avoid circular imports
        from django.conf import settings
        
        # Create MongoDB indexes if configured
        if hasattr(settings, 'MONGODB_INDEXES'):
            try:
                from .mongodb_utils import get_mongodb_database
                import pymongo
                
                db = get_mongodb_database()
                for index_config in settings.MONGODB_INDEXES:
                    collection = index_config['collection']
                    fields = index_config['fields']
                    unique = index_config.get('unique', False)
                    sparse = index_config.get('sparse', False)
                    
                    index_options = {
                        'unique': unique,
                        'sparse': sparse
                    }
                    
                    if 'partialFilterExpression' in index_config:
                        index_options['partialFilterExpression'] = index_config['partialFilterExpression']
                        
                    db[collection].create_index(fields, **index_options)
            except Exception as e:
                print(f"Failed to create MongoDB indexes: {e}")