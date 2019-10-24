const t = require('babel-types');
const PathUtils = require('@twist/babel-plugin-transform/src/PathUtils');

module.exports = class FragmentTransform {
    static apply(path) {
        if (!path.node || path.node.type !== 'JSXElement' || PathUtils.getJSXElementName(path) !== 'fragment') {
            return false;
        }

        const children = path.node.children
          .filter(({ type }) => [ 'JSXElement', 'JSXExpressionContainer' ].includes(type))
          .map((node, i) => {
            if (node.type === 'JSXElement') {
                const key = PathUtils.getAttribute({ node }, 'key');
                if (!key) {
                    node.openingElement.attributes.push({
                        type: 'JSXAttribute',
                        name: {
                            type: 'JSXIdentifier',
                            name: 'key',
                        },
                        value: {
                            type: 'StringLiteral',
                            value: i.toString(),
                        },
                    });
                }
            }
            return node;
          });

        const expr = PathUtils.jsxChildrenToJS(children);
        path.replaceWith(PathUtils.maybeWrapJSXExpression(path, expr));
        return true;
    }
};
