import { CommentIcon } from '@sanity/icons'

export default {
    name: 'comment',
    type: 'document',
    title: 'Comment',
    icon: CommentIcon,
    fields: [
        {
            name: 'name',
            title: "User Name",
            type: 'string',
        },
        {
            name: 'comment',
            title: "Comment",
            type: 'text',
        },
        {
            name: 'post',
            title: "Post",
            type: 'reference',
            to: [
                { type: 'post' }
            ]
        }
    ],
    preview: {
        select: {
            name: 'name',
            comment: 'comment',
            post: 'post.title'
        },
        prepare({ name, comment, post }) {
            return {
                title: `${name} on ${post}`,
                subtitle: comment
            }
        }
    }
}
