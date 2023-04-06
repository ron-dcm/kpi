# Generated by Django 3.2.15 on 2023-03-15 14:01

from django.conf import settings
from django.core.paginator import Paginator
from django.db import migrations


def create_extra_user_detail(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        return

    print(
        """
        This migration might take a while. If it is too slow, you may want to
        re-run migrations with SKIP_HEAVY_MIGRATIONS=True and apply this one
        manually from the django shell.
        """
    )

    User = apps.get_model('auth', 'User')
    ExtraUserDetail = apps.get_model('hub', 'ExtraUserDetail')

    page_size = 10000
    user_w_extradetails_ids = list(
        ExtraUserDetail.objects.values_list('user_id', flat=True)
    )
    paginator = Paginator(
        User.objects.values_list('pk', flat=True).order_by('pk').exclude(
            pk__in=user_w_extradetails_ids
        ),
        page_size,
    )
    for page in paginator.page_range:
        user_ids = paginator.page(page).object_list
        ExtraUserDetail.objects.bulk_create(
            [
                ExtraUserDetail(
                    user_id=user_id,
                    data={'name': '', 'organization': ''},
                )
                for user_id in user_ids
            ],
            ignore_conflicts=True,
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_extra_user_detail, noop),
    ]
